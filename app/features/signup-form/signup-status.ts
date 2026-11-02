export const SIGNUP_STATUSES = [
  "confirmed",
  "waitlisted",
  "cancelled",
] as const;

export type SignupStatus = (typeof SIGNUP_STATUSES)[number];

/** Statuses that hold a place: a seat, or a spot on the waiting list. */
export const ACTIVE_SIGNUP_STATUSES = [
  "confirmed",
  "waitlisted",
] as const satisfies SignupStatus[];

export function isSignupStatus(value: unknown): value is SignupStatus {
  return (SIGNUP_STATUSES as readonly unknown[]).includes(value);
}

/** Unknown values (a hand-edited row, a newer deploy) read as confirmed. */
export function toSignupStatus(value: unknown): SignupStatus {
  return isSignupStatus(value) ? value : "confirmed";
}

const FRIENDS_LIST_NAME = "friends";

/** The signer plus every friend they listed. */
export function partySize(answers: Record<string, unknown>): number {
  const friends = answers[FRIENDS_LIST_NAME];
  return 1 + (Array.isArray(friends) ? friends.length : 0);
}

export function normalizeSignupEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * A party gets in only as a whole: when every one of its seats is still free.
 * Otherwise the whole party waits — also when it is larger than the event
 * itself, so an admin can still decide.
 */
export function decideSignupStatus({
  slots,
  confirmedSeats,
  seats,
}: {
  slots: number;
  confirmedSeats: number;
  seats: number;
}): "confirmed" | "waitlisted" {
  return confirmedSeats + seats <= slots ? "confirmed" : "waitlisted";
}

export function seatsLeft(slots: number, confirmedSeats: number): number {
  return Math.max(0, slots - confirmedSeats);
}
