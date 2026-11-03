import {
  CalendarIcon,
  CreditCardIcon,
  MapPinIcon,
  UserIcon,
} from "lucide-react";

import { formatEventDateLine } from "../date-format";
import type { SerializableDate } from "../view-models";

import { useText } from "~/features/site-text/site-text-context";

export function EventDateHeading({ date }: { date: SerializableDate }) {
  const eventDate = new Date(date);

  return (
    <span className="text-primary flex items-center gap-2 text-sm font-semibold">
      <CalendarIcon className="size-4" />
      <time dateTime={eventDate.toISOString()} suppressHydrationWarning>
        {formatEventDateLine(eventDate, "long")}
      </time>
    </span>
  );
}

export function EventLocationFact({ addressLine }: { addressLine: string }) {
  const t = useText();

  return (
    <span className="flex items-center gap-2">
      <MapPinIcon className="text-muted-foreground size-4" />
      <span className="sr-only">{t("events.facts.locationLabel")}</span>
      <span>{addressLine}</span>
    </span>
  );
}

export function EventPriceFact({
  price,
  studentPrice = null,
}: {
  price: number;
  studentPrice?: number | null;
}) {
  const t = useText();

  return (
    <span className="flex items-center gap-2">
      <CreditCardIcon className="text-muted-foreground size-4" />
      <span className="sr-only">{t("events.facts.priceLabel")}</span>
      {t("events.facts.price", { price })}
      {studentPrice !== null ? (
        <span className="text-muted-foreground">
          {t("events.facts.studentPrice", { price: studentPrice })}
        </span>
      ) : null}
    </span>
  );
}

export function EventSeatsFact({
  slots,
  seatsLeft = null,
}: {
  slots: number;
  /** Omitted where the page doesn't know how many seats are taken. */
  seatsLeft?: number | null;
}) {
  const t = useText();
  let label = t("events.facts.seats", { slots });
  if (seatsLeft === 0) label = t("events.facts.fullyBooked");
  else if (seatsLeft !== null) {
    label = t("events.facts.seatsLeft", { left: seatsLeft, slots });
  }

  return (
    <span className="flex items-center gap-2">
      <UserIcon className="text-muted-foreground size-4" />
      <span>{label}</span>
    </span>
  );
}
