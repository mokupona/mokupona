import { CalendarIcon, InfoIcon } from "lucide-react";

import { formatEventDateLine } from "../date-format";
import type { EventDetailModel } from "../view-models";

import {
  EventDateHeading,
  EventLocationFact,
  EventPriceFact,
  EventSeatsFact,
} from "./event-facts";

import { CoverImage } from "~/components/cover-image";
import { MarkdownText } from "~/components/markdown-text";
import { pageTitleClassName } from "~/components/section";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "~/components/ui/accordion";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import { useText } from "~/features/site-text/site-text-context";

export interface EventViewProps {
  event: EventDetailModel;
}

export function EventStory({ event }: EventViewProps) {
  const t = useText();

  return (
    <div className="flex min-w-0 flex-col gap-5 md:gap-6">
      <div className="paper-photo">
        <CoverImage
          image={event.image}
          alt=""
          sizes="(min-width: 1024px) 520px, 100vw"
          className="w-full"
        />
      </div>

      <div className="flex flex-col gap-3">
        <EventDateHeading date={event.date} />
        <h1 className={pageTitleClassName}>{event.title}</h1>
      </div>

      <MarkdownText
        html={event.descriptionHtml}
        className="text-foreground/80 text-base font-light md:text-lg"
      />

      {event.menuHtml || event.donationHtml ? (
        <Accordion defaultValue={["menu"]} className="mt-2 border-t">
          {event.menuHtml ? (
            <AccordionItem value="menu">
              <AccordionTrigger className="text-primary">
                {t("events.detail.menu")}
              </AccordionTrigger>
              <AccordionContent className="pb-6">
                <MarkdownText
                  html={event.menuHtml}
                  className="text-foreground/80 text-base font-light"
                />
              </AccordionContent>
            </AccordionItem>
          ) : null}

          {event.donationHtml ? (
            <AccordionItem value="donation">
              <AccordionTrigger className="text-primary">
                {t("events.detail.donation")}
              </AccordionTrigger>
              <AccordionContent className="pb-6">
                <MarkdownText
                  html={event.donationHtml}
                  className="text-foreground/80 text-base font-light"
                />
              </AccordionContent>
            </AccordionItem>
          ) : null}
        </Accordion>
      ) : null}
    </div>
  );
}

export function EventFactList({
  event,
  seatsLeft = null,
}: EventViewProps & { seatsLeft?: number | null }) {
  const t = useText();
  const eventDate = new Date(event.date);

  return (
    <div data-halo className="text-foreground/80 flex flex-col gap-3 text-sm">
      <span className="flex items-center gap-2">
        <CalendarIcon className="text-muted-foreground size-4" />
        <time dateTime={eventDate.toISOString()} suppressHydrationWarning>
          {formatEventDateLine(eventDate, "short")}
        </time>
      </span>

      <EventLocationFact addressLine={event.addressLine} />

      <div className="flex items-center justify-between">
        <EventPriceFact
          price={event.price}
          studentDiscount={event.studentDiscount}
          vegetarianDiscount={event.vegetarianDiscount}
        />

        <Popover>
          <PopoverTrigger>
            <span className="text-primary border-primary/60 flex items-center gap-1 border-b border-dotted text-xs">
              {t("events.facts.discounts")}
              <InfoIcon className="size-4" />
            </span>
          </PopoverTrigger>
          <PopoverContent>
            {event.discountsHtml ? (
              <MarkdownText html={event.discountsHtml} className="text-sm" />
            ) : (
              <p className="text-sm">{t("events.facts.noDiscounts")}</p>
            )}
          </PopoverContent>
        </Popover>
      </div>

      <EventSeatsFact slots={event.slots} seatsLeft={seatsLeft} />
    </div>
  );
}

export function EventView({ event }: EventViewProps) {
  return (
    <div className="flex flex-col gap-6">
      <EventFactList event={event} />
      <EventStory event={event} />
    </div>
  );
}
