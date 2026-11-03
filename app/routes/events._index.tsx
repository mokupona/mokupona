import type { Route } from "./+types/events._index";

import { HandDrawnRule } from "~/components/hand-drawn";
import {
  Eyebrow,
  PageContainer,
  pageTitleClassName,
  SectionDivider,
} from "~/components/section";
import { buttonVariants } from "~/components/ui/button";
import {
  FeaturedEventCard,
  CompactEventCard,
} from "~/features/events/components/event-card";
import {
  orderEventsByStatus,
  partitionEvents,
} from "~/features/events/event-status";
import { toEventCardModel } from "~/features/events/view-models";
import { cn } from "~/lib/utils";
import { getEventsWithAddress } from "~/models/event.server";

export const loader = async () => {
  const events = await getEventsWithAddress();

  return { events: events.map(toEventCardModel) };
};

export const meta: Route.MetaFunction = () => [{ title: "Events" }];

export default function EventsIndexPage({ loaderData }: Route.ComponentProps) {
  const { events } = loaderData;

  const now = new Date();
  const { upcoming: upcomingEvents, past } = partitionEvents(events, now);
  const pastEvents = orderEventsByStatus(past, now);

  // One dinner gets the big card. Any others still appear below rather than
  // being dropped — a scheduled dinner nobody can find is a dinner nobody can
  // book — but they stay compact so the next one keeps the page.
  const [nextDinner, ...laterDinners] = upcomingEvents;

  return (
    <PageContainer className="grow pt-14 pb-32 md:pt-20">
      <div className="mb-14 flex flex-col gap-4 md:mb-20">
        <Eyebrow>gatherings</Eyebrow>
        <h1 className={pageTitleClassName}>events</h1>
        <p className="text-foreground/80 max-w-2xl text-base font-light md:text-lg">
          {upcomingEvents.length > 0
            ? "a handful of seats open before each supper. reserve early, tables are small and fill quickly."
            : "we run a handful of intimate events a year. there's nothing on the calendar right now, but the next one is never far off."}
        </p>
      </div>

      {nextDinner ? (
        <>
          <SectionDivider className="mb-5" handwritten="nextDinner">
            the next event
          </SectionDivider>
          <div className="mb-14 md:mb-20">
            <FeaturedEventCard event={nextDinner} />
          </div>

          {laterDinners.length > 0 ? (
            <>
              <SectionDivider className="mb-5">also coming up</SectionDivider>
              <div className="mb-14 grid grid-cols-2 gap-3 md:mb-20 md:grid-cols-3 md:gap-5 lg:grid-cols-4">
                {laterDinners.map((event) => (
                  <CompactEventCard key={event.id} event={event} />
                ))}
              </div>
            </>
          ) : null}
        </>
      ) : (
        <EmptyState />
      )}

      {pastEvents.length > 0 ? (
        <>
          <SectionDivider className="mb-5" handwritten="pastDinners">
            past events
          </SectionDivider>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-5 lg:grid-cols-4">
            {pastEvents.map((event) => (
              <CompactEventCard key={event.id} event={event} />
            ))}
          </div>
        </>
      ) : null}
    </PageContainer>
  );
}

function EmptyState() {
  return (
    <div className="mb-14 flex flex-col gap-5 py-10 md:mb-20 md:gap-6 md:py-16">
      <HandDrawnRule className="text-crayon/45 w-32" />
      <span className="text-muted-foreground text-sm font-semibold">
        nothing on the calendar right now
      </span>
      <h2 className={cn("max-w-md", pageTitleClassName)}>
        the table is being set
      </h2>
      <p className="text-muted-foreground max-w-md text-sm font-light md:text-lg">
        we&apos;re planning the next gathering. check back soon to see
        what&apos;s next, or follow along on instagram for the announcement.
      </p>
      <a
        href="https://instagram.com/mokupona"
        target="_blank"
        rel="noopener noreferrer"
        className={cn(
          buttonVariants({ variant: "outline", size: "lg" }),
          "mt-1 w-fit",
        )}
      >
        follow on instagram
      </a>
    </div>
  );
}
