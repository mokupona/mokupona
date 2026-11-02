import type {
  FieldDescriptor,
  NonListFieldDescriptor,
} from "~/features/forms/fields";

const FRIENDS_LIST_NAME = "friends";
const NAME_FIELD = "name";
// a guest who ticks this checkbox pays the event's student price, if it has one
const STUDENT_FIELD = "student";

const EMPTY_ANSWER = "—";

export type SummaryRow = readonly [label: string, value: string];

export interface BookingGuest {
  name: string;
  isStudent: boolean;
  /** What this guest pays, in CHF. */
  price: number;
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
  studentPrice: number | null;
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
    "Guest 1",
  );

  const friendItems = Array.isArray(answers[FRIENDS_LIST_NAME])
    ? (answers[FRIENDS_LIST_NAME] as unknown[])
    : [];
  const friends = friendItems.map((item, index) =>
    toGuest(itemFields, asRecord(item), prices, `Guest ${index + 2}`),
  );

  const guests = [signer, ...friends];

  return {
    guests,
    contact: topLevel
      .filter(
        (field) =>
          field.data.name !== NAME_FIELD && !perGuestNames.has(field.data.name),
      )
      .map((field) => toRow(field, answers)),
    total: guests.reduce((sum, guest) => sum + guest.price, 0),
  };
}

function toGuest(
  fields: NonListFieldDescriptor[],
  answers: Record<string, unknown>,
  prices: BookingPrices,
  fallbackName: string,
): BookingGuest {
  const name = answers[NAME_FIELD];
  const isStudent = answers[STUDENT_FIELD] === true;

  return {
    name: typeof name === "string" && name.trim() ? name.trim() : fallbackName,
    isStudent,
    price:
      isStudent && prices.studentPrice !== null
        ? prices.studentPrice
        : prices.price,
    rows: fields
      .filter((field) => field.data.name !== NAME_FIELD)
      .map((field) => toRow(field, answers)),
  };
}

function toRow(
  field: NonListFieldDescriptor,
  answers: Record<string, unknown>,
): SummaryRow {
  return [field.data.label, formatAnswer(field, answers[field.data.name])];
}

function formatAnswer(field: NonListFieldDescriptor, value: unknown): string {
  if (field.type === "checkbox") return value === true ? "yes" : "no";
  if (typeof value === "string" && value.trim()) return value.trim();
  return EMPTY_ANSWER;
}

function asRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return {};
  }
  return value as Record<string, unknown>;
}

export function formatChf(amount: number): string {
  return amount === 0 ? "free" : `${amount} CHF`;
}
