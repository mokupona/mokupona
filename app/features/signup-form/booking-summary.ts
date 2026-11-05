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

  return {
    name: typeof name === "string" && name.trim() ? name.trim() : fallbackName,
    isStudent,
    vegetarian,
    price: guestPrice(prices, { isStudent, vegetarian }),
    email:
      typeof friendEmail === "string" && friendEmail.trim()
        ? friendEmail.trim()
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

export function formatChf(amount: number, t: Text): string {
  return amount === 0
    ? t("emails.signup.free")
    : t("emails.signup.amount", { amount });
}
