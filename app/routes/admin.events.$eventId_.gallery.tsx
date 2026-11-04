import type { SubmissionResult } from "@conform-to/react";
import { ImageIcon, Trash2Icon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Form, NavLink, redirect } from "react-router";
import { z } from "zod";

import type { Route } from "./+types/admin.events.$eventId_.gallery";

import { AdminEmptyState, AdminPageHeader } from "~/components/admin-ui";
import { Field, fileFieldClassName } from "~/components/forms";
import { OptimizedImage } from "~/components/optimized-image";
import { RouteErrorContent } from "~/components/route-error-content";
import { Button, buttonVariants } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
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
  caption: z.string().trim().optional(),
});

export async function loader({ params }: Route.LoaderArgs) {
  const { eventId } = params;

  const [event, entries] = await Promise.all([
    getEventById(eventId).then(requireFound),
    getGalleryEntriesForEventWithReuse(eventId),
  ]);

  return {
    event: { id: event.id, title: event.title },
    entries,
    // the file input's hint; the constant itself is server-only
    maxFiles: MAX_GALLERY_FILES,
  };
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

export async function action({ request, params }: Route.ActionArgs) {
  const { eventId } = params;
  const galleryPath = `/admin/events/${eventId}/gallery`;

  // before any upload is stored: an event deleted in another tab must yield
  // a 404, not stranded provider assets
  await getEventById(eventId).then(requireFound);

  // The upload arrives as multipart and has to stream through the image
  // parser before any field is readable; remove is a plain post, so its
  // intent is read straight off the parsed body.
  if (request.headers.get("content-type")?.includes("multipart/form-data")) {
    return withParsedImageForm(request, {
      fieldName: "images",
      schema: GalleryUploadSchema,
      maxFiles: MAX_GALLERY_FILES,
      async onSuccess({ value, formData }) {
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

        return redirect(galleryPath);
      },
    });
  }

  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "remove") {
    const entryId = formData.get("entryId");

    if (typeof entryId === "string") {
      const removed = await removeGalleryEntry(eventId, entryId);
      // the image survives an unlink while anything still references it;
      // only the last unlink hands back a key to destroy, bytes last
      if (removed?.deletedStorageKey) {
        await destroyImages([removed.deletedStorageKey]);
      }
    }

    return redirect(galleryPath);
  }

  throw unknownIntent();
}

export const meta: Route.MetaFunction = ({ loaderData }) => [
  {
    title: loaderData
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

export default function AdminEventGalleryPage({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  const { event, entries, maxFiles } = loaderData;
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  const uploadFormRef = useRef<HTMLFormElement>(null);
  const galleryCount = useRef(entries.length);

  useEffect(() => {
    if (entries.length > galleryCount.current) uploadFormRef.current?.reset();
    galleryCount.current = entries.length;
  }, [entries.length]);

  const imageErrors = actionData?.error?.images;

  return (
    <div className="animate-page-in">
      <AdminPageHeader
        eyebrow={event.title}
        title="Gallery"
        subtitle="The photos linked to this event's gallery. Captions belong to this event, not to the file."
        actions={
          <NavLink
            to={`/admin/events/${event.id}`}
            className={buttonVariants({ variant: "outline" })}
          >
            Back to event
          </NavLink>
        }
      />

      <div className="flex flex-col gap-10">
        <section className="flex flex-col gap-4">
          <div>
            <h2 className="text-xl font-semibold">Add photos</h2>
            <p className="text-muted-foreground mt-1 text-sm">
              Uploads land in this event&apos;s gallery, in the order you choose
              them.
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
                Upload to this event
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
                              name="entryId"
                              value={entry.id}
                            />
                            <DialogClose
                              render={
                                <Button type="button" variant="outline" />
                              }
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
      </div>
    </div>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  return <RouteErrorContent error={error} />;
}
