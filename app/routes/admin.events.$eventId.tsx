import { EyeOffIcon } from "lucide-react";
import { data, Form, Link } from "react-router";

import type { Route } from "./+types/admin.events.$eventId";

import { Button, buttonVariants } from "~/components/ui/button";
import { requestLoggerContext } from "~/features/auth/middleware.server";
import {
  DEFAULT_CHECKLIST_CATEGORY,
  normalizeChecklistLabel,
  parseChecklistCategory,
} from "~/features/events/checklist";
import { AdminEventChecklist } from "~/features/events/components/admin-event-checklist";
import { AdminEventQrCode } from "~/features/events/components/admin-event-qr-code";
import { EventView } from "~/features/events/components/event-view";
import { toEventDetailModel } from "~/features/events/view-models.server";
import {
  addChecklistItem,
  addDefaultChecklistItems,
  deleteChecklistItem,
  getChecklistForEvent,
  setChecklistItemDone,
  updateChecklistItem,
} from "~/models/event-checklist.server";
import { getEventById, setEventPublished } from "~/models/event.server";
import { getDomainUrl, requireFound } from "~/shared/http.server";
import { redirectWithToast } from "~/utils/toast.server";

export async function loader({ params, request }: Route.LoaderArgs) {
  const [event, checklist] = await Promise.all([
    getEventById(params.eventId).then(requireFound),
    getChecklistForEvent(params.eventId),
  ]);

  return {
    event: toEventDetailModel(event),
    publicUrl: new URL(`/events/${event.id}`, getDomainUrl(request)).href,
    checklist: checklist.map((item) => ({
      id: item.id,
      label: item.label,
      category:
        parseChecklistCategory(item.category) ?? DEFAULT_CHECKLIST_CATEGORY,
      done: item.doneAt !== null,
    })),
  };
}

export async function action({ params, request, context }: Route.ActionArgs) {
  const { eventId } = params;
  const log = context.get(requestLoggerContext);
  requireFound(await getEventById(eventId));

  const formData = await request.formData();
  const intent = formData.get("intent");
  const itemId = formData.get("itemId");

  switch (intent) {
    case "publish":
    case "unpublish": {
      const published = intent === "publish";
      await setEventPublished(eventId, published);
      log.info({ event: eventId, published }, "Admin changed event visibility");
      return redirectWithToast(
        `/admin/events/${eventId}`,
        published
          ? {
              title: "Event published",
              description: "It's now on the public site and open for signups.",
              type: "success",
            }
          : {
              title: "Event unpublished",
              description: "It's a draft again: only admins can see it.",
              type: "success",
            },
      );
    }
    case "checklist-add": {
      const label = normalizeChecklistLabel(formData.get("label"));
      const category = parseChecklistCategory(formData.get("category"));
      if (!label || !category) {
        throw new Response("Bad Request", { status: 400 });
      }
      await addChecklistItem(eventId, { label, category });
      return data({ ok: true });
    }
    case "checklist-update": {
      const label = normalizeChecklistLabel(formData.get("label"));
      const category = parseChecklistCategory(formData.get("category"));
      if (typeof itemId !== "string" || !label || !category) {
        throw new Response("Bad Request", { status: 400 });
      }
      if (!(await updateChecklistItem(eventId, itemId, { label, category }))) {
        throw new Response("Not Found", { status: 404 });
      }
      return data({ ok: true });
    }
    case "checklist-defaults": {
      await addDefaultChecklistItems(eventId);
      return data({ ok: true });
    }
    case "checklist-toggle": {
      if (typeof itemId !== "string") {
        throw new Response("Bad Request", { status: 400 });
      }
      const done = formData.get("done") === "true";
      if (!(await setChecklistItemDone(eventId, itemId, done))) {
        throw new Response("Not Found", { status: 404 });
      }
      return data({ ok: true });
    }
    case "checklist-delete": {
      if (typeof itemId !== "string") {
        throw new Response("Bad Request", { status: 400 });
      }
      // already gone (e.g. a double click) is fine
      await deleteChecklistItem(eventId, itemId);
      return data({ ok: true });
    }
    default:
      throw new Response("Bad Request", { status: 400 });
  }
}

export const meta: Route.MetaFunction = ({ loaderData }) => {
  return [
    {
      title: loaderData ? `Event - ${loaderData.event.title}` : "Event",
    },
  ];
};

export default function EventPage({ loaderData }: Route.ComponentProps) {
  const { event, publicUrl, checklist } = loaderData;

  return (
    <main className="flex grow flex-col gap-5">
      {event.published ? null : <DraftBanner />}

      <div className="bg-card text-card-foreground flex flex-col gap-3 rounded-lg p-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm leading-none font-semibold">
          You are viewing the admin view of this event.
        </p>

        <span className="flex flex-wrap gap-2">
          <Link
            to="signups"
            className={buttonVariants({ variant: "ghost", size: "sm" })}
          >
            View Signups
          </Link>
          <Link
            to="volunteers"
            className={buttonVariants({ variant: "ghost", size: "sm" })}
          >
            Volunteers
          </Link>
          <Link
            to={`/admin/gallery?event=${encodeURIComponent(event.id)}`}
            className={buttonVariants({ variant: "ghost", size: "sm" })}
          >
            Gallery
          </Link>
          <Link
            to="edit"
            className={buttonVariants({ variant: "ghost", size: "sm" })}
          >
            Edit
          </Link>
          {event.published ? (
            <Form method="POST">
              <Button
                type="submit"
                name="intent"
                value="unpublish"
                variant="outline"
                size="sm"
              >
                Unpublish
              </Button>
            </Form>
          ) : null}
          <Form method="POST" action="delete">
            <Button type="submit" variant="destructive" size="sm">
              Delete
            </Button>
          </Form>
        </span>
      </div>

      <AdminEventChecklist items={checklist} />

      {/* a draft's public link is a 404, so there's nothing to share yet */}
      {event.published ? (
        <AdminEventQrCode url={publicUrl} title={event.title} />
      ) : null}

      <EventView event={event} />
    </main>
  );
}

function DraftBanner() {
  return (
    <div className="border-primary bg-primary/10 flex flex-col gap-3 border p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <EyeOffIcon className="text-primary mt-0.5 size-5 shrink-0" />
        <div>
          <p className="font-semibold">This event is a draft</p>
          <p className="text-muted-foreground text-sm">
            It isn't on the public site and nobody can sign up yet. The preview
            below is what guests will see once it's published.
          </p>
        </div>
      </div>
      <Form method="POST" className="shrink-0">
        <Button type="submit" name="intent" value="publish">
          Publish
        </Button>
      </Form>
    </div>
  );
}
