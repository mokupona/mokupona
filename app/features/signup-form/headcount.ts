import type { PriceShare } from "./payments";
import type { SignupStatus } from "./signup-status";

/** What a guest's answers say about how they eat and what they pay. */
export interface HeadcountGuest {
  isStudent: boolean;
  /** null when the event's form never asks about diet. */
  vegetarian: boolean | null;
  /** Ticked on the signup sheet at the door. */
  arrived?: boolean;
  /** Set on the signup sheet; full when left out. */
  priceShare?: PriceShare;
  /** Ticked on the signup sheet: works the dinner, takes no seat. */
  helper?: boolean;
}

export interface HeadcountParty {
  status: SignupStatus;
  guests: HeadcountGuest[];
}

/**
 * People, counted one by one, for one group of signups. Everyone eats, so
 * every count but `guests` and `helpers` takes the helpers in too.
 */
export interface Headcount {
  /** Everyone: the guests and the helpers. */
  people: number;
  /** The people who take a seat: everyone but the helpers. */
  guests: number;
  helpers: number;
  vegetarian: number;
  notVegetarian: number;
  /** Guests whose form has no diet question; they're in neither count above. */
  dietNotAsked: number;
  students: number;
  notStudents: number;
  /** People ticked as arrived on the night. */
  arrived: number;
  /** People set to pay half their price, or nothing (helpers, mostly). */
  paysHalf: number;
  paysNothing: number;
}

export interface HeadcountSummary {
  confirmed: Headcount;
  waitlisted: Headcount;
}

function emptyHeadcount(): Headcount {
  return {
    people: 0,
    guests: 0,
    helpers: 0,
    vegetarian: 0,
    notVegetarian: 0,
    dietNotAsked: 0,
    students: 0,
    notStudents: 0,
    arrived: 0,
    paysHalf: 0,
    paysNothing: 0,
  };
}

/**
 * Counts the people holding a confirmed seat and the people on the waiting
 * list, split into guests and helpers, by diet and by student status, how
 * many of them have arrived, and how many pay half or nothing. Cancelled signups count for nothing, like in the revenue figures.
 */
export function summarizeHeadcount(
  parties: HeadcountParty[],
): HeadcountSummary {
  const summary: HeadcountSummary = {
    confirmed: emptyHeadcount(),
    waitlisted: emptyHeadcount(),
  };

  for (const party of parties) {
    const bucket =
      party.status === "confirmed"
        ? summary.confirmed
        : party.status === "waitlisted"
          ? summary.waitlisted
          : null;
    if (!bucket) continue;

    for (const guest of party.guests) {
      bucket.people += 1;
      if (guest.helper) bucket.helpers += 1;
      else bucket.guests += 1;
      if (guest.vegetarian === null) bucket.dietNotAsked += 1;
      else if (guest.vegetarian) bucket.vegetarian += 1;
      else bucket.notVegetarian += 1;

      if (guest.isStudent) bucket.students += 1;
      else bucket.notStudents += 1;

      if (guest.arrived) bucket.arrived += 1;

      if (guest.priceShare === "half") bucket.paysHalf += 1;
      else if (guest.priceShare === "none") bucket.paysNothing += 1;
    }
  }

  return summary;
}
