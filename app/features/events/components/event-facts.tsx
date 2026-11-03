import {
  CalendarIcon,
  CreditCardIcon,
  MapPinIcon,
  UserIcon,
} from "lucide-react";

import { formatEventDateLine } from "../date-format";
import type { SerializableDate } from "../view-models";

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
  return (
    <span className="flex items-center gap-2">
      <MapPinIcon className="text-muted-foreground size-4" />
      <span className="sr-only">location</span>
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
  return (
    <span className="flex items-center gap-2">
      <CreditCardIcon className="text-muted-foreground size-4" />
      <span className="sr-only">price</span>
      {price} chf
      {studentPrice !== null ? (
        <span className="text-muted-foreground">
          · students {studentPrice} chf
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
  let label = `${slots} seats`;
  if (seatsLeft === 0) label = "fully booked · waiting list open";
  else if (seatsLeft !== null) label = `${seatsLeft} of ${slots} seats left`;

  return (
    <span className="flex items-center gap-2">
      <UserIcon className="text-muted-foreground size-4" />
      <span>{label}</span>
    </span>
  );
}
