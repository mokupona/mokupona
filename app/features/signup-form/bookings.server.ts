import {
  guestPrice,
  summarizeBooking,
  type BookingGuest,
  type BookingPrices,
  type BookingSummary,
  type SummaryRow,
} from "./booking-summary";
import { toSentSignupMail, type SentSignupMail } from "./signup-mails";
import { toSignupStatus, type SignupStatus } from "./signup-status";

import { parseStoredFormSchemaOrLog } from "~/features/forms/serialization.server";
import type { Text } from "~/features/site-text/text";
import { requestLogger } from "~/logger/request-context.server";
import {
  getEventResponsesForEvent,
  type EventResponse,
} from "~/models/event-response.server";
import { getFormSubmissionsForEvent } from "~/models/form-submission.server";

/** One signup, read back the way its confirmation mail reads it. */
export interface SignupBooking {
  submissionId: string;
  status: SignupStatus;
  createdAt: Date;
  /** From before signup forms existed: shown, with a fixed status. */
  isLegacy: boolean;
  /** The signer's own address, as they typed it. */
  signerEmail: string;
  /** Admin bookkeeping: whether each half of the payment is in. */
  firstHalfPaid: boolean;
  secondHalfPaid: boolean;
  /** Admin bookkeeping: free text, never shown to the guest. */
  adminNote: string;
  /**
   * False when the site didn't keep track of this signup's mails (it's from
   * before that, or older still): no record doesn't mean no mail.
   */
  mailsTracked: boolean;
  /** The mails that went out about this signup, oldest first. */
  mails: SentSignupMail[];
  booking: BookingSummary;
}

/**
 * Every signup for an event, oldest first, priced at the event's current
 * prices. Uses the same reading as the confirmation mail, so the money shown
 * to an admin is the money the guest was told about.
 */
export async function getSignupBookingsForEvent(
  eventId: string,
  prices: BookingPrices,
  t: Text,
): Promise<SignupBooking[]> {
  const [legacyRows, submissions] = await Promise.all([
    getEventResponsesForEvent(eventId),
    getFormSubmissionsForEvent(eventId),
  ]);

  const bookings = submissions.flatMap((submission): SignupBooking[] => {
    const formFields = parseStoredFormSchemaOrLog(submission.formVersion);
    const answers = asRecord(submission.answers);
    if (!formFields || !answers) {
      requestLogger.error(
        { event: eventId, submission: submission.id },
        "Skipped a signup that can't be read back for the admin view",
      );
      return [];
    }

    return [
      {
        submissionId: submission.id,
        status: toSignupStatus(submission.status),
        createdAt: submission.createdAt,
        isLegacy: false,
        signerEmail: asString(answers.email),
        firstHalfPaid: submission.firstHalfPaid,
        secondHalfPaid: submission.secondHalfPaid,
        adminNote: submission.adminNote,
        mailsTracked: submission.mailsTracked,
        mails: submission.mails.flatMap(toSentSignupMail),
        booking: summarizeBooking(formFields, answers, prices, t),
      },
    ];
  });

  const legacy = legacyRows.map((row): SignupBooking => ({
    submissionId: row.id,
    status: "confirmed",
    createdAt: row.createdAt,
    isLegacy: true,
    signerEmail: row.email,
    // pre-form signups have no payment bookkeeping; the page doesn't offer it
    firstHalfPaid: false,
    secondHalfPaid: false,
    adminNote: "",
    mailsTracked: false,
    mails: [],
    booking: legacyBooking(row, prices, t),
  }));

  return [...legacy, ...bookings].sort(
    (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
  );
}

/** A pre-form signup has one guest, with the answers it was stored with. */
function legacyBooking(
  row: EventResponse,
  prices: BookingPrices,
  t: Text,
): BookingSummary {
  const isStudent = row.student === true;
  const price = guestPrice(prices, {
    isStudent,
    vegetarian: row.vegetarian === true,
  });
  const guest: BookingGuest = {
    name: row.name,
    isStudent,
    // the old form always asked about diet, so an unanswered row reads as no
    vegetarian: row.vegetarian === true,
    price,
    email: null,
    rows: [
      ["Vegan / Vegetarian", yesNo(row.vegetarian === true, t)],
      ["Student", yesNo(isStudent, t)],
      ["Dietary restrictions", orDash(row.restrictions)],
    ],
  };

  return {
    guests: [guest],
    contact: [
      ["Email", row.email],
      ["Phone number", orDash(row.phone)],
      ["Comment", orDash(row.comment)],
    ] satisfies SummaryRow[],
    total: price,
  };
}

function yesNo(value: boolean, t: Text): string {
  return value ? t("emails.signup.yes") : t("emails.signup.no");
}

function orDash(value: string | null | undefined): string {
  return value && value.trim() ? value.trim() : "—";
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}
