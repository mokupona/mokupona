import type {
  FieldDescriptor,
  NonListFieldDescriptor,
} from "~/features/forms/fields";
import type { Text } from "~/features/site-text/text";

const FRIENDS_LIST_NAME = "friends";
const NAME_FIELD = "name";
// a guest who ticks this checkbox gets the event's student discount, if any
const STUDENT_FIELD = "student";
// ticked by a guest who eats vegetarian (the checkbox reads "Vegan / Vegetarian");
// they get the event's vegetarian discount, if any
const VEGETARIAN_FIELD = "vegetarian";
// what a guest can't or won't eat. The default form asks for it under this
// key; a form whose admin renamed it is matched by its key or label instead
const RESTRICTIONS_FIELD = "restrictions";
const RESTRICTIONS_HINT = /restriction|allerg|intoleran|diet/i;
/**
 * Answers to the restrictions question that mean there are none, compared
 * lowercased, without a trailing full stop or exclamation mark.
 */
const NO_RESTRICTIONS = new Set([
  "-",
  "--",
  "—",
  "–",
  "/",
  "x",
  "no",
  "nope",
  "none",
  "nothing",
  "nothing special",
  "n/a",
  "na",
  "no restrictions",
  "no allergies",
  "kein",
  "keine",
  "keins",
  "nein",
  "nichts",
  "keine allergien",
  "keine einschränkungen",
]);
/**
 * Optional, inside the friends list: where to send the friend a note that the
 * signer put them down. Read as the guest's `email`, not as a row.
 */
export const FRIEND_EMAIL_FIELD = "friend_email";

const EMPTY_ANSWER = "—";

export type SummaryRow = readonly [label: string, value: string];

export interface BookingGuest {
  name: string;
  isStudent: boolean;
  /** Whether they eat vegetarian; null when the form doesn't ask. */
  vegetarian: boolean | null;
  /** What this guest pays, in CHF. */
  price: number;
  /** Where they asked to hear about the signup; null when none was given. */
  email: string | null;
  /**
   * What they wrote under dietary restrictions (allergies, intolerances, …);
   * null when they left it blank or wrote that there are none.
   */
  restrictions: string | null;
  /** Their personal answers (diet, student, …), in form order. */
  rows: SummaryRow[];
}

export interface BookingSummary {
  /** The person who signed up comes first, then their friends. */
  guests: BookingGuest[];
  /** Answers that belong to the whole signup (email, phone, comment, …). */
  contact: SummaryRow[];
  total: number;
}

/**
 * A booking as it stands once an admin has cancelled some of its people on
 * their own: only those still coming, and what they come to at the prices
 * they signed up at. `cancelled` holds their places in the booking (0 is the
 * signer).
 */
export function bookingWithout(
  booking: BookingSummary,
  cancelled: ReadonlySet<number>,
): BookingSummary {
  if (cancelled.size === 0) return booking;
  const guests = booking.guests.filter(
    (_, guestIndex) => !cancelled.has(guestIndex),
  );
  return {
    ...booking,
    guests,
    total: guests.reduce((sum, guest) => sum + guest.price, 0),
  };
}

export interface BookingPrices {
  price: number;
  /** CHF off for a student; null when the event has no student discount. */
  studentDiscount: number | null;
  /** CHF off for a vegetarian; null when the event has none. */
  vegetarianDiscount: number | null;
}

/** An event's pricing, as the booking reads it. */
export function bookingPrices(event: BookingPrices): BookingPrices {
  return {
    price: event.price,
    studentDiscount: event.studentDiscount,
    vegetarianDiscount: event.vegetarianDiscount,
  };
}

/**
 * What one guest pays: the full price minus every discount they qualify for.
 * The discounts stack, and the result never drops below zero.
 */
export function guestPrice(
  prices: BookingPrices,
  guest: { isStudent: boolean; vegetarian: boolean | null },
): number {
  let amount = prices.price;
  if (guest.isStudent) amount -= prices.studentDiscount ?? 0;
  if (guest.vegetarian === true) amount -= prices.vegetarianDiscount ?? 0;
  return Math.max(0, amount);
}

/**
 * Reads a stored signup back as a party of guests, using the form version it
 * was submitted against. Top-level fields that the friends list repeats
 * (vegetarian, student, …) describe the signer; the rest describe the signup.
 */
export function summarizeBooking(
  descriptors: FieldDescriptor[],
  answers: Record<string, unknown>,
  prices: BookingPrices,
  t: Text,
): BookingSummary {
  const friendsList = descriptors.find(
    (field) => field.type === "list" && field.data.name === FRIENDS_LIST_NAME,
  );
  const itemFields =
    friendsList?.type === "list" ? friendsList.data.itemFields : [];
  const perGuestNames = new Set(itemFields.map((field) => field.data.name));

  const topLevel = descriptors.filter(
    (field): field is NonListFieldDescriptor => field.type !== "list",
  );

  const signer = toGuest(
    topLevel.filter((field) => perGuestNames.has(field.data.name)),
    answers,
    prices,
    t("emails.signup.guestFallback", { number: 1 }),
    t,
  );
  // a form that asks about restrictions once, outside the friends list,
  // asks the signer
  if (signer.restrictions === null) {
    const field = restrictionsField(topLevel);
    if (field)
      signer.restrictions = restrictionsAnswer(answers[field.data.name]);
  }

  const friendItems = Array.isArray(answers[FRIENDS_LIST_NAME])
    ? (answers[FRIENDS_LIST_NAME] as unknown[])
    : [];
  const friends = friendItems.map((item, index) =>
    toGuest(
      itemFields,
      asRecord(item),
      prices,
      t("emails.signup.guestFallback", { number: index + 2 }),
      t,
    ),
  );

  const guests = [signer, ...friends];

  return {
    guests,
    contact: topLevel
      .filter(
        (field) =>
          field.data.name !== NAME_FIELD && !perGuestNames.has(field.data.name),
      )
      .map((field) => toRow(field, answers, t)),
    total: guests.reduce((sum, guest) => sum + guest.price, 0),
  };
}

function toGuest(
  fields: NonListFieldDescriptor[],
  answers: Record<string, unknown>,
  prices: BookingPrices,
  fallbackName: string,
  t: Text,
): BookingGuest {
  const name = answers[NAME_FIELD];
  const isStudent = answers[STUDENT_FIELD] === true;

  const friendEmail = answers[FRIEND_EMAIL_FIELD];
  const asksVegetarian = fields.some(
    (field) => field.data.name === VEGETARIAN_FIELD,
  );

  const vegetarian = asksVegetarian ? answers[VEGETARIAN_FIELD] === true : null;
  const restrictions = restrictionsField(fields);

  return {
    name: typeof name === "string" && name.trim() ? name.trim() : fallbackName,
    isStudent,
    vegetarian,
    price: guestPrice(prices, { isStudent, vegetarian }),
    email:
      typeof friendEmail === "string" && friendEmail.trim()
        ? friendEmail.trim()
        : null,
    restrictions: restrictions
      ? restrictionsAnswer(answers[restrictions.data.name])
      : null,
    rows: fields
      .filter(
        (field) =>
          field.data.name !== NAME_FIELD &&
          field.data.name !== FRIEND_EMAIL_FIELD,
      )
      .map((field) => toRow(field, answers, t)),
  };
}

/** The field that asks about dietary restrictions, if the form has one. */
function restrictionsField(
  fields: readonly NonListFieldDescriptor[],
): NonListFieldDescriptor | undefined {
  return (
    fields.find((field) => field.data.name === RESTRICTIONS_FIELD) ??
    fields.find(
      (field) =>
        (field.type === "text" || field.type === "textarea") &&
        (RESTRICTIONS_HINT.test(field.data.name) ||
          RESTRICTIONS_HINT.test(field.data.label)),
    )
  );
}

/**
 * A guest's answer about their dietary restrictions, trimmed; null when they
 * left it blank or wrote that there are none ("no", "none", "keine", …).
 */
export function restrictionsAnswer(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const answer = value.trim().replace(/\s+/g, " ");
  const plain = answer.toLowerCase().replace(/[.!]+$/, "");
  return answer && !NO_RESTRICTIONS.has(plain) ? answer : null;
}

function toRow(
  field: NonListFieldDescriptor,
  answers: Record<string, unknown>,
  t: Text,
): SummaryRow {
  return [field.data.label, formatAnswer(field, answers[field.data.name], t)];
}

function formatAnswer(
  field: NonListFieldDescriptor,
  value: unknown,
  t: Text,
): string {
  if (field.type === "checkbox") {
    return value === true ? t("emails.signup.yes") : t("emails.signup.no");
  }
  if (typeof value === "string" && value.trim()) return value.trim();
  return EMPTY_ANSWER;
}

function asRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return {};
  }
  return value as Record<string, unknown>;
}

/**
 * A price for a guest's mail. Whole francs stay whole; half of an odd price
 * (the first payment) shows its Rappen: "22.50 CHF".
 */
export function formatChf(amount: number, t: Text): string {
  if (amount === 0) return t("emails.signup.free");
  return t("emails.signup.amount", {
    amount: Number.isInteger(amount) ? amount : amount.toFixed(2),
  });
}
