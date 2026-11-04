import { PlusIcon, UtensilsIcon } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";

import type { Route } from "./+types/admin.events._index";

import { AdminDeleteButton } from "~/components/admin-delete-button";
import {
  AdminEmptyState,
  AdminPageHeader,
  AdminSearchField,
  FilterChip,
  SeatProgress,
} from "~/components/admin-ui";
import { CoverImage } from "~/components/cover-image";
import { buttonVariants } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { formatAdminDateLine } from "~/features/events/date-format";
import {
  isPastEvent,
  orderEventsByStatus,
} from "~/features/events/event-status";
import { cn } from "~/lib/utils";
import { getSeatCountsByEvent } from "~/models/event-signup.server";
import { getEventsWithAddress } from "~/models/event.server";

export async function loader() {
  const events = await getEventsWithAddress();
  const seatCounts = await getSeatCountsByEvent(
    events.map((event) => event.id),
  );

  return {
    events: events.map((event) => ({
      id: event.id,
      title: event.title,
      date: event.date,
      image: event.image,
      slots: event.slots,
      location: `${event.address.streetName} ${event.address.houseNumber}`,
      confirmed: seatCounts[event.id]?.confirmed ?? 0,
      waitlisted: seatCounts[event.id]?.waitlisted ?? 0,
    })),
  };
}

export const meta: Route.MetaFunction = () => {
  return [{ title: "Admin - Events" }];
};

const FILTERS = [
  { id: "all", label: "All" },
  { id: "upcoming", label: "Upcoming" },
  { id: "past", label: "Past" },
] as const;

type Filter = (typeof FILTERS)[number]["id"];

export default function AdminEventsPage({ loaderData }: Route.ComponentProps) {
  const { events } = loaderData;
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const now = new Date();
  const q = query.trim().toLowerCase();

  const filtered = events
    .map((event) => ({
      ...event,
      past: isPastEvent(new Date(event.date), now),
    }))
    .filter((event) =>
      filter === "all" ? true : filter === "past" ? event.past : !event.past,
    )
    .filter(
      (event) =>
        !q ||
        event.title.toLowerCase().includes(q) ||
        event.location.toLowerCase().includes(q),
    );
  const visible = orderEventsByStatus(filtered, now);

  return (
    <div className="animate-page-in">
      <AdminPageHeader
        eyebrow={`${events.length} total`}
        title="Events"
        actions={
          <Link to="new" className={buttonVariants()}>
            <PlusIcon className="size-4" />
            New event
          </Link>
        }
      />

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <AdminSearchField
          value={query}
          onChange={setQuery}
          placeholder="Search events"
        />
        <div className="flex gap-2">
          {FILTERS.map(({ id, label }) => (
            <FilterChip
              key={id}
              active={filter === id}
              onClick={() => setFilter(id)}
            >
              {label}
            </FilterChip>
          ))}
        </div>
      </div>

      {visible.length > 0 ? (
        <div className="flex flex-col gap-3">
          {visible.map((event) => (
            <EventCard key={event.id} event={event} />
          ))}
        </div>
      ) : (
        <AdminEmptyState
          icon={<UtensilsIcon className="size-6" />}
          title="No events match"
          description="Try a different search or filter — or create the next event for the season."
          action={
            <Link to="new" className={buttonVariants()}>
              New event
            </Link>
          }
        />
      )}
    </div>
  );
}

type Event = Awaited<ReturnType<typeof loader>>["events"][number] & {
  past: boolean;
};

function EventCard({ event }: { event: Event }) {
  const date = new Date(event.date);

  return (
    <Card
      interactive
      className={cn(
        "relative flex flex-wrap items-center gap-3 p-4",
        event.past && "opacity-60",
      )}
    >
      <CoverImage
        image={event.image}
        alt=""
        sizes="160px"
        className="w-40 shrink-0 rounded-lg border"
      />

      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div>
          <p
            className={cn(
              "text-xs font-semibold tracking-wide",
              event.past ? "text-muted-foreground" : "text-accent-light",
            )}
          >
            <time dateTime={date.toISOString()} suppressHydrationWarning>
              {formatAdminDateLine(date)}
            </time>
          </p>
          <h2 className="mt-1 truncate text-base font-semibold">
            {/* stretched link: the pseudo-element makes the whole card the
                hit area while the accessible name stays the event title;
                the action row sits above it via `relative` */}
            <Link
              to={event.id}
              className="focus-visible:after:ring-ring after:absolute after:inset-0 focus-visible:after:ring-2 after:focus-visible:outline-hidden"
            >
              {event.title}
            </Link>
          </h2>
          <p className="text-muted-foreground mt-1 text-sm">{event.location}</p>
        </div>
        <div className="max-w-xs">
          <div className="mb-2 flex justify-between text-xs">
            <span className="text-foreground/80">
              {event.confirmed} confirmed
              {event.waitlisted > 0 ? ` · ${event.waitlisted} waiting` : ""}
            </span>
            <span className="text-muted-foreground">
              {event.confirmed} / {event.slots}
            </span>
          </div>
          <SeatProgress
            taken={event.confirmed}
            total={event.slots}
            muted={event.past}
          />
        </div>
      </div>

      <div className="relative flex flex-wrap gap-2">
        <Link
          to={`${event.id}/signups`}
          className={buttonVariants({ variant: "ghost", size: "sm" })}
        >
          Signups
        </Link>
        <Link
          to={`${event.id}/edit`}
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          Edit
        </Link>
        <AdminDeleteButton action={`${event.id}/delete`} />
      </div>
    </Card>
  );
}
