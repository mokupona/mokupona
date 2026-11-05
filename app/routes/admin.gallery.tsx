import type { SubmissionResult } from "@conform-to/react";
import { ImageIcon, Trash2Icon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Form, redirect, useSubmit } from "react-router";
import { z } from "zod";

import type { Route } from "./+types/admin.gallery";

import {
  GALLERY_SHAPES,
  ImageFramingDialog,
} from "~/components/admin-image-framer";
import { AdminEmptyState, AdminPageHeader } from "~/components/admin-ui";
import { Field, fileFieldClassName, SelectField } from "~/components/forms";
import { OptimizedImage } from "~/components/optimized-image";
import { RouteErrorContent } from "~/components/route-error-content";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import { formatEventMonthYear } from "~/features/events/date-format";
import { withParsedImageForm } from "~/features/images/image-form-action.server";
import {
  destroyImages,
  storeImages,
} from "~/features/images/image-storage.server";
import { cn } from "~/lib/utils";
import { getEventById } from "~/models/event.server";
import {
  createGalleryImagesForEvent,
  getGalleryEntriesForEventWithReuse,
  getGalleryPickerEvents,
  removeGalleryEntry,
  type GalleryEventLabel,
} from "~/models/gallery.server";
import { requireFound, unknownIntent } from "~/shared/http.server";
import {
  imageFileSchema,
  MAX_GALLERY_FILES,
  VALID_IMAGE_TYPES,
} from "~/shared/image";

// The files are validated one by one against imageFileSchema() below, so the
// schema only owns the batch's own fields.
const GalleryUploadSchema = z.object({
  intent: z.literal("upload"),
  eventId: z.string().min(1, "Choose an event"),
  caption: z.string().trim().optional(),
});

export async function loader({ request }: Route.LoaderArgs) {
  const events = await getGalleryPickerEvents();
  const requested = new URL(request.url).searchParams.get("event");
  const now = new Date();

  // An explicit pick wins; otherwise the most recent dinner that already
  // happened, since that is the one with fresh photos to hang.
  const selected =
    events.find((event) => event.id === requested) ??
    events.find((event) => event.date < now) ??
    events.at(0) ??
    null;

  const entries = selected
    ? await getGalleryEntriesForEventWithReuse(selected.id)
    : [];

  return {
    events,
    event: selected ? { id: selected.id, title: selected.title } : null,
    entries,
    // the file input's hint; the constant itself is server-only
    maxFiles: MAX_GALLERY_FILES,
  };
}

function galleryPathFor(eventId: string) {
  return `/admin/gallery?event=${encodeURIComponent(eventId)}`;
}

const galleryList = new Intl.ListFormat("en", {
  style: "long",
  type: "conjunction",
});

function partialUploadMessage(
  stored: number,
  total: number,
  unstored: string[],
): string {
  const names = galleryList.format(unstored);

  return stored === 0
    ? `None of the ${total} photos could be stored — ${names} failed. Try again.`
    : `Uploaded ${stored} of ${total} photos — ${names} failed. Try those again.`;
}

export async function action({ request }: Route.ActionArgs) {
  // The upload arrives as multipart and has to stream through the image
  // parser before any field is readable; remove is a plain post, so its
  // intent is read straight off the parsed body.
  if (request.headers.get("content-type")?.includes("multipart/form-data")) {
    return withParsedImageForm(request, {
      fieldName: "images",
      schema: GalleryUploadSchema,
      maxFiles: MAX_GALLERY_FILES,
      async onSuccess({ value, formData }) {
        const { eventId } = value;

        // before any upload is stored: an event deleted in another tab must
        // yield a 404, not stranded provider assets
        await getEventById(eventId).then(requireFound);

        const files = formData
          .getAll("images")
          .filter(
            (entry): entry is File => entry instanceof File && entry.size > 0,
          );

        const fileSchema = imageFileSchema();
        const errors = files.flatMap((file) => {
          const result = fileSchema.safeParse(file);
          return result.success
            ? []
            : result.error.issues.map((issue) => issue.message);
        });
        if (files.length === 0) errors.push("Choose at least one image");

        if (errors.length > 0) {
          const failed: SubmissionResult = {
            status: "error",
            error: { images: [...new Set(errors)] },
          };
          return failed;
        }

        const results = await storeImages(files, "event-gallery");

        const stored = results.flatMap((result, index) =>
          result.status === "fulfilled"
            ? [
                {
                  contentType: files[index].type,
                  caption: value.caption || null,
                  ...result.value,
                },
              ]
            : [],
        );

        try {
          await createGalleryImagesForEvent(eventId, stored);
        } catch (error) {
          await destroyImages(stored.map((image) => image.storageKey));
          throw error;
        }

        const unstored = files
          .filter((_, index) => results[index].status === "rejected")
          .map((file) => file.name);

        if (unstored.length > 0) {
          const partial: SubmissionResult = {
            status: "error",
            error: {
              images: [
                partialUploadMessage(stored.length, files.length, unstored),
              ],
            },
          };
          return partial;
        }

        return redirect(galleryPathFor(eventId));
      },
    });
  }

  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "remove") {
    const eventId = formData.get("eventId");
    const entryId = formData.get("entryId");

    if (typeof eventId !== "string" || !eventId) throw unknownIntent();

    if (typeof entryId === "string") {
      const removed = await removeGalleryEntry(eventId, entryId);
      // the image survives an unlink while anything still references it;
      // only the last unlink hands back a key to destroy, bytes last
      if (removed?.deletedStorageKey) {
        await destroyImages([removed.deletedStorageKey]);
      }
    }

    return redirect(galleryPathFor(eventId));
  }

  throw unknownIntent();
}

export const meta: Route.MetaFunction = ({ loaderData }) => [
  {
    title: loaderData?.event
      ? `Admin - Gallery - ${loaderData.event.title}`
      : "Admin - Gallery",
  },
];

function deletePhotoDescription(sharedWith: GalleryEventLabel[]): string {
  if (sharedWith.length === 0) {
    return "This photo isn't linked to any other event, so deleting it also deletes the file. This can't be undone.";
  }

  const others = galleryList.format(sharedWith.map((event) => event.title));

  return `This photo is also linked to ${others}, so deleting it here only removes it from this event's gallery. The file stays.`;
}

export default function AdminGalleryPage({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  const { events, event, entries, maxFiles } = loaderData;
  const submit = useSubmit();

  return (
    <div className="animate-page-in">
      <AdminPageHeader
        eyebrow="Photos"
        title="Gallery"
        subtitle="Upload photos to an event's gallery. Everything here ends up in the public gallery roll once the event has happened."
      />

      {event ? (
        <div className="flex flex-col gap-10">
          <Form method="GET" replace className="max-w-md">
            <SelectField
              labelProps={{ children: "Event" }}
              description="Choose which event's gallery you're working on."
              selectProps={{
                name: "event",
                value: event.id,
                onChange: (change) => {
                  void submit(change.currentTarget.form, { replace: true });
                },
                options: events.map((option) => ({
                  value: option.id,
                  label: `${option.title} · ${formatEventMonthYear(new Date(option.date))} (${option.imageCount} ${option.imageCount === 1 ? "photo" : "photos"})`,
                })),
              }}
            />
          </Form>

          {/* keyed so switching events starts from a clean upload form */}
          <EventGalleryManager
            key={event.id}
            event={event}
            entries={entries}
            maxFiles={maxFiles}
            actionData={actionData}
          />
        </div>
      ) : (
        <AdminEmptyState
          icon={<ImageIcon className="size-6" />}
          title="No events yet"
          description="Create an event first — photos are always uploaded to an event's gallery."
        />
      )}
    </div>
  );
}

function EventGalleryManager({
  event,
  entries,
  maxFiles,
  actionData,
}: {
  event: { id: string; title: string };
  entries: Route.ComponentProps["loaderData"]["entries"];
  maxFiles: number;
  actionData: Route.ComponentProps["actionData"];
}) {
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  const uploadFormRef = useRef<HTMLFormElement>(null);
  const galleryCount = useRef(entries.length);

  useEffect(() => {
    if (entries.length > galleryCount.current) uploadFormRef.current?.reset();
    galleryCount.current = entries.length;
  }, [entries.length]);

  const imageErrors = actionData?.error?.images;

  return (
    <>
      <section className="flex flex-col gap-4">
        <div>
          <h2 className="text-xl font-semibold">Add photos</h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Uploads land in {event.title}&apos;s gallery, in the order you
            choose them.
          </p>
        </div>

        <Card className="p-4">
          <Form
            ref={uploadFormRef}
            method="POST"
            encType="multipart/form-data"
            replace
            className="flex flex-col gap-4"
          >
            <input type="hidden" name="intent" value="upload" />
            <input type="hidden" name="eventId" value={event.id} />

            <Field
              labelProps={{ children: "Photos" }}
              inputProps={{
                name: "images",
                type: "file",
                multiple: true,
                tabIndex: 0,
                accept: VALID_IMAGE_TYPES.join(","),
                className: cn(
                  fileFieldClassName,
                  imageErrors?.length && "border-destructive-light/50",
                ),
              }}
              description={`or drop them here — up to ${maxFiles} at a time`}
              errors={imageErrors}
            />

            <Field
              labelProps={{ children: "Caption (optional)" }}
              inputProps={{ name: "caption", type: "text" }}
              description="Applies to every photo in this upload."
              errors={actionData?.error?.caption}
            />

            <Button type="submit" className="self-start">
              Upload photos
            </Button>
          </Form>
        </Card>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-xl font-semibold">
          In this gallery{" "}
          <span className="text-muted-foreground font-normal">
            ({entries.length})
          </span>
        </h2>

        {entries.length === 0 ? (
          <AdminEmptyState
            icon={<ImageIcon className="size-6" />}
            title="No photos yet"
            description="Upload a few above and they show up here, newest last."
          />
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {entries.map((entry) => (
              <li key={entry.id}>
                <Card className="flex h-full flex-col overflow-hidden">
                  <OptimizedImage
                    image={entry.image}
                    width={480}
                    height={320}
                    alt={entry.altText ?? event.title}
                  />
                  <div className="flex items-center gap-3 p-4">
                    <p className="min-w-0 flex-1 truncate text-sm">
                      {entry.caption ?? (
                        <span className="text-muted-foreground">
                          No caption
                        </span>
                      )}
                    </p>

                    <ImageFramingDialog
                      image={entry.image}
                      shapes={GALLERY_SHAPES}
                      title="Adjust this photo"
                      iconOnly
                      className="-my-2 size-11 shrink-0 sm:my-0 sm:size-7"
                    />

                    <Dialog
                      open={pendingDelete === entry.id}
                      onOpenChange={(open) =>
                        setPendingDelete(open ? entry.id : null)
                      }
                    >
                      <DialogTrigger
                        render={
                          <Button
                            type="button"
                            variant="destructive-outline"
                            size="icon-sm"
                            aria-label="Delete photo"
                            className="-my-2 -mr-2 size-11 shrink-0 sm:my-0 sm:mr-0 sm:size-7"
                          />
                        }
                      >
                        <Trash2Icon className="size-4" />
                      </DialogTrigger>

                      <DialogContent
                        showClose={false}
                        overlayClassName="bg-background/75"
                        className="gap-4 p-4 shadow-[0_24px_64px_rgba(0,0,0,0.55)]"
                      >
                        <div className="flex items-start gap-3">
                          <OptimizedImage
                            image={entry.image}
                            width={96}
                            height={64}
                            alt=""
                            className="w-24 shrink-0 rounded-lg"
                          />
                          <div className="flex flex-col gap-1">
                            <DialogTitle className="text-xl font-semibold">
                              Delete this photo?
                            </DialogTitle>
                            <DialogDescription>
                              {deletePhotoDescription(entry.sharedWith)}
                            </DialogDescription>
                          </div>
                        </div>

                        <Form
                          method="POST"
                          replace
                          className="flex justify-end gap-3"
                        >
                          <input type="hidden" name="intent" value="remove" />
                          <input
                            type="hidden"
                            name="eventId"
                            value={event.id}
                          />
                          <input
                            type="hidden"
                            name="entryId"
                            value={entry.id}
                          />
                          <DialogClose
                            render={<Button type="button" variant="outline" />}
                          >
                            Cancel
                          </DialogClose>
                          <Button type="submit" variant="destructive-outline">
                            Delete photo
                          </Button>
                        </Form>
                      </DialogContent>
                    </Dialog>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  return <RouteErrorContent error={error} />;
}
