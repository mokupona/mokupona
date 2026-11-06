import type { SignupStatus } from "./signup-status";

/** What a guest's answers say about how they eat and what they pay. */
export interface HeadcountGuest {
  isStudent: boolean;
  /** null when the event's form never asks about diet. */
  vegetarian: boolean | null;
  /** Ticked on the signup sheet at the door. */
  arrived?: boolean;
}

export interface HeadcountParty {
  status: SignupStatus;
  guests: HeadcountGuest[];
}

/** People, counted one by one, for one group of signups. */
export interface Headcount {
  people: number;
  vegetarian: number;
  notVegetarian: number;
  /** Guests whose form has no diet question; they're in neither count above. */
  dietNotAsked: number;
  students: number;
  notStudents: number;
  /** People ticked as arrived on the night. */
  arrived: number;
}

export interface HeadcountSummary {
  confirmed: Headcount;
  waitlisted: Headcount;
}

function emptyHeadcount(): Headcount {
  return {
    people: 0,
    vegetarian: 0,
    notVegetarian: 0,
    dietNotAsked: 0,
    students: 0,
    notStudents: 0,
    arrived: 0,
  };
}

/**
 * Counts the people holding a confirmed seat and the people on the waiting
 * list, split by diet and by student status, and how many of them have
 * arrived. Cancelled signups count for nothing, like in the revenue figures.
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
      if (guest.vegetarian === null) bucket.dietNotAsked += 1;
      else if (guest.vegetarian) bucket.vegetarian += 1;
      else bucket.notVegetarian += 1;

      if (guest.isStudent) bucket.students += 1;
      else bucket.notStudents += 1;

      if (guest.arrived) bucket.arrived += 1;
    }
  }

  return summary;
}
