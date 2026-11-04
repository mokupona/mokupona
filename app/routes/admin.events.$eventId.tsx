import { Form, Link } from "react-router";

import type { Route } from "./+types/admin.events.$eventId";

import { Button, buttonVariants } from "~/components/ui/button";
import { EventView } from "~/features/events/components/event-view";
import { toEventDetailModel } from "~/features/events/view-models";
import { getEventById } from "~/models/event.server";
import { requireFound } from "~/shared/http.server";

export async function loader({ params }: Route.LoaderArgs) {
  const event = requireFound(await getEventById(params.eventId));

  return { event: toEventDetailModel(event) };
}

export const meta: Route.MetaFunction = ({ loaderData }) => {
  return [
    {
      title: loaderData ? `Event - ${loaderData.event.title}` : "Event",
    },
  ];
};

export default function EventPage({ loaderData }: Route.ComponentProps) {
  const { event } = loaderData;

  return (
    <main className="flex grow flex-col gap-5">
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
            to="gallery"
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
          <Form method="POST" action="delete">
            <Button type="submit" variant="destructive" size="sm">
              Delete
            </Button>
          </Form>
        </span>
      </div>

      <EventView event={event} />
    </main>
  );
}
