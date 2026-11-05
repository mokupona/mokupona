import { Link } from "react-router";

import { formatEventMonthYear } from "../date-format";
import type { EventCardModel } from "../view-models";

import {
  EventDateHeading,
  EventLocationFact,
  EventPriceFact,
  EventSeatsFact,
} from "./event-facts";

import { CoverImage } from "~/components/cover-image";
import { SecondaryCTA } from "~/components/section";
import { Badge } from "~/components/ui/badge";
import { buttonVariants } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { useText } from "~/features/site-text/site-text-context";

export function FeaturedEventCard({
  event,
  isNext = true,
  /** The landing page hides these; /events keeps them for choosing. */
  showFacts = true,
}: {
  event: EventCardModel;
  isNext?: boolean;
  showFacts?: boolean;
}) {
  const t = useText();

  return (
    // No panel: the photograph and the type sit straight on the paper, and
    // the column gap does the separating a card fill used to do.
    <article className="flex flex-col gap-6 lg:flex-row lg:gap-10">
      <div className="paper-photo lg:w-3/5 lg:shrink-0">
        <CoverImage
          image={event.image}
          alt=""
          sizes="(min-width: 1024px) 584px, 100vw"
          className="w-full"
        />
        {isNext ? (
          // a torn paper banner stuck on the photo's corner
          <div className="absolute top-3 left-3 -rotate-2">
            <Badge pill className="paper-torn border-0 bg-transparent">
              {t("events.card.nextBadge")}
            </Badge>
          </div>
        ) : null}
      </div>

      {/* one halo for the whole text column, like the landing page's other
          text blocks, rather than a patch per line */}
      <div
        data-halo
        className="flex min-w-0 flex-1 flex-col justify-center gap-4"
      >
        <EventDateHeading date={event.date} />

        <h2 className="line-clamp-2 text-2xl leading-tight font-light tracking-tight lg:text-3xl">
          {event.title}
        </h2>

        <p className="text-muted-foreground line-clamp-3 text-sm font-light lg:line-clamp-2 lg:text-base">
          {event.description}
        </p>

        {showFacts ? (
          <div className="text-muted-foreground flex flex-wrap gap-4 border-y py-3 text-sm md:gap-6">
            <EventLocationFact addressLine={event.addressLine} />
            <EventPriceFact price={event.price} />
            <EventSeatsFact slots={event.slots} />
          </div>
        ) : null}

        <div className="mt-1 flex flex-col gap-4 md:flex-row md:items-center md:gap-5">
          <Link
            to={`/events/${event.id}#sign-up`}
            className={buttonVariants({ variant: "paper" })}
          >
            {t("events.card.reserve")}
          </Link>
          <SecondaryCTA to={`/events/${event.id}`} className="max-md:hidden">
            {t("events.card.readMore")}
          </SecondaryCTA>
        </div>
      </div>
    </article>
  );
}

export function CompactEventCard({ event }: { event: EventCardModel }) {
  const t = useText();
  const eventDate = new Date(event.date);
  const hasGallery = event.galleryImageCount > 0;

  return (
    <Link
      to={hasGallery ? `/events/${event.id}/gallery` : `/events/${event.id}`}
      className="group flex flex-col gap-2"
    >
      {/* torn paper like the rest of the photos; it stays put on hover, the
          title's underline is the hover cue */}
      <div className="paper-photo">
        <CoverImage
          image={event.image}
          alt=""
          sizes="(min-width: 768px) 300px, 45vw"
          className="w-full"
        />
      </div>
      <span className="text-muted-foreground flex items-center gap-2 text-xs">
        <time dateTime={eventDate.toISOString()} suppressHydrationWarning>
          {formatEventMonthYear(eventDate)}
        </time>
        {hasGallery ? <span aria-hidden="true">·</span> : null}
        {hasGallery ? (
          <span>
            {t(
              event.galleryImageCount === 1
                ? "site.photoCount.one"
                : "site.photoCount.other",
              { count: event.galleryImageCount },
            )}
          </span>
        ) : null}
      </span>
      <h4 className="text-base font-light group-hover:underline md:text-lg">
        {event.title}
      </h4>
    </Link>
  );
}
