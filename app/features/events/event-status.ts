import { EVENT_TIMEZONE } from "./timezone";

export function isPastEvent(date: Date, now: Date): boolean {
  return date.getTime() < now.getTime();
}

const eventDayFormat = new Intl.DateTimeFormat("en-US", {
  timeZone: EVENT_TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** The calendar day a moment falls on in Zürich, as `YYYY-MM-DD`. */
function eventDay(date: Date): string {
  const parts = eventDayFormat.formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((entry) => entry.type === type)?.value ?? "";

  return `${part("year")}-${part("month")}-${part("day")}`;
}

/**
 * Whether the event's day is over in Zürich. Signups stay open until then,
 * so a friend can still sign up on the evening itself, after the start.
 */
export function isAfterEventDay(date: Date, now: Date): boolean {
  return eventDay(now) > eventDay(date);
}

export function partitionEvents<T extends { date: Date | string }>(
  events: T[],
  now: Date,
): { upcoming: T[]; past: T[] } {
  const upcoming: T[] = [];
  const past: T[] = [];

  for (const event of events) {
    if (isPastEvent(new Date(event.date), now)) {
      past.push(event);
    } else {
      upcoming.push(event);
    }
  }

  return { upcoming, past };
}

export function orderEventsByStatus<T extends { date: Date | string }>(
  events: readonly T[],
  now: Date,
): T[] {
  return [...events].sort((a, b) => {
    const aDate = new Date(a.date);
    const bDate = new Date(b.date);
    const aPast = isPastEvent(aDate, now);
    const bPast = isPastEvent(bDate, now);

    if (aPast !== bPast) return aPast ? 1 : -1;

    const difference = aDate.getTime() - bDate.getTime();
    return aPast ? -difference : difference;
  });
}
