import { PlusIcon } from "lucide-react";
import { Link } from "react-router";

import type { Route } from "./+types/admin._index";

import {
  AdminPageHeader,
  InitialsAvatar,
  SeatProgress,
} from "~/components/admin-ui";
import { CoverImage } from "~/components/cover-image";
import { Eyebrow } from "~/components/section";
import { buttonVariants } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import {
  formatAdminDateLine,
  formatAdminTimestamp,
  formatAdminToday,
} from "~/features/events/date-format";
import { getAttendeesForEvent } from "~/features/signup-form/read.server";
import { cn } from "~/lib/utils";
import { getNextEvent } from "~/models/event.server";

export async function loader() {
  const nextEvent = await getNextEvent();
  const attendees = nextEvent ? await getAttendeesForEvent(nextEvent.id) : [];

  const todayLabel = formatAdminToday(new Date());

  return {
    todayLabel,
    nextEvent: nextEvent
      ? {
          id: nextEvent.id,
          title: nextEvent.title,
          date: nextEvent.date,
          image: nextEvent.image,
          slots: nextEvent.slots,
          street: `${nextEvent.address.streetName} ${nextEvent.address.houseNumber}`,
          seatsTaken: attendees.length,
        }
      : null,
    recentSignups: attendees
      .slice(-6)
      .reverse()
      .map(({ name, email, createdAt }) => ({ name, email, createdAt })),
  };
}

export const meta: Route.MetaFunction = () => {
  return [{ title: "Admin" }];
};

export default function AdminOverviewPage({
  loaderData,
}: Route.ComponentProps) {
  const { todayLabel, nextEvent, recentSignups } = loaderData;

  return (
    <div className="animate-page-in">
      <AdminPageHeader
        eyebrow={todayLabel}
        title="Overview"
        subtitle="Here's what's coming up for moku pona."
        actions={
          <>
            <Link
              to="locations/new"
              className={buttonVariants({ variant: "outline" })}
            >
              New location
            </Link>
            <Link to="events/new" className={buttonVariants()}>
              <PlusIcon className="size-4" />
              New event
            </Link>
          </>
        }
      />

      <div className="flex flex-col gap-4">
        {nextEvent ? (
          <NextEventCard event={nextEvent} />
        ) : (
          <Card className="p-6 text-center">
            <p className="text-lg font-semibold">No upcoming event</p>
            <p className="text-muted-foreground mt-1 text-sm">
              Create the next event to see it here.
            </p>
          </Card>
        )}

        <Card className="p-4 md:p-5">
          <div className="mb-2 flex items-center justify-between md:mb-3">
            <h2 className="text-base font-semibold">Recent signups</h2>
            {nextEvent ? (
              <Link
                to={`events/${nextEvent.id}/signups`}
                prefetch="intent"
                className="text-muted-foreground hover:text-foreground text-sm transition-colors"
              >
                View all
              </Link>
            ) : null}
          </div>

          {recentSignups.length > 0 ? (
            <div className="grid grid-cols-1 gap-x-7 md:grid-cols-2">
              {recentSignups.map((signup, index) => (
                <div
                  key={`${signup.email}-${index}`}
                  className="flex items-center gap-3 border-b py-3"
                >
                  <InitialsAvatar name={signup.name} seed={index} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">
                      {signup.name}
                    </p>
                    <p className="text-muted-foreground truncate text-sm">
                      {signup.email}
                    </p>
                  </div>
                  <time
                    dateTime={new Date(signup.createdAt).toISOString()}
                    suppressHydrationWarning
                    className="text-muted-foreground text-xs whitespace-nowrap"
                  >
                    {formatAdminTimestamp(new Date(signup.createdAt))}
                  </time>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground py-2 text-sm">
              No signups yet.
            </p>
          )}
        </Card>
      </div>
    </div>
  );
}

type NextEvent = NonNullable<Awaited<ReturnType<typeof loader>>["nextEvent"]>;

function NextEventCard({ event }: { event: NextEvent }) {
  const date = new Date(event.date);

  return (
    <Card className="flex flex-wrap items-center gap-3 p-4">
      <CoverImage
        image={event.image}
        alt=""
        sizes="160px"
        className="w-40 shrink-0 rounded-lg border"
      />

      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <div>
          <Eyebrow variant="tracked" tone="label">
            Next event
          </Eyebrow>
          <h2 className="mt-1 truncate text-lg font-semibold">{event.title}</h2>
          <p className="text-muted-foreground mt-1 text-sm">
            <time dateTime={date.toISOString()} suppressHydrationWarning>
              {formatAdminDateLine(date)}
            </time>
            {" · "}
            {event.street}
          </p>
        </div>
        <div className="flex max-w-md items-center gap-3">
          <SeatProgress taken={event.seatsTaken} total={event.slots} />
          <span className="text-muted-foreground text-sm whitespace-nowrap">
            {event.seatsTaken} / {event.slots} seats
          </span>
        </div>
      </div>

      <div className="flex gap-2 max-md:w-full">
        <Link
          to={`events/${event.id}/signups`}
          className={cn(buttonVariants({ size: "sm" }), "max-md:flex-1")}
        >
          View signups
        </Link>
        <Link
          to={`events/${event.id}/edit`}
          className={cn(
            buttonVariants({ variant: "outline", size: "sm" }),
            "max-md:flex-1",
          )}
        >
          Edit
        </Link>
      </div>
    </Card>
  );
}
