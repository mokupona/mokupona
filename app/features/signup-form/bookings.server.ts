import {
  guestPrice,
  restrictionsAnswer,
  summarizeBooking,
  type BookingGuest,
  type BookingPrices,
  type BookingSummary,
  type SummaryRow,
} from "./booking-summary";
import { EMPTY_GUEST_BOOKKEEPING, type GuestBookkeeping } from "./bookkeeping";
import {
  chfToRappen,
  priceAfterShare,
  toPaymentMethod,
  toPriceShare,
  type PaymentMethod,
} from "./payments";
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
  /**
   * Admin bookkeeping: whether each half of the payment is in, and how. When
   * the party pays in one payment, the first half stands for it.
   */
  singlePayment: boolean;
  firstHalfPaid: boolean;
  secondHalfPaid: boolean;
  firstHalfMethod: PaymentMethod;
  secondHalfMethod: PaymentMethod;
  /**
   * Admin bookkeeping: whether the mail the status calls for went out, by
   * their own mark; null goes by `mails`.
   */
  confirmationMarkedSent: boolean | null;
  /** Admin bookkeeping: whether the party was reminded to pay. */
  paymentReminderSent: boolean;
  /** Admin bookkeeping: free text, never shown to the guest. */
  adminNote: string;
  /** Admin bookkeeping per person, in the order of `booking.guests`. */
  guestBookkeeping: GuestBookkeeping[];
  /**
   * What the party pays, in CHF: each person's price after the share an
   * admin set for them, and nothing for anyone cancelled on their own.
   * `booking.total` stays what they signed up at.
   */
  amountDue: number;
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

    const booking = summarizeBooking(formFields, answers, prices, t);
    const guestBookkeeping = perGuest(
      booking.guests.length,
      submission.guestBookkeeping,
    );

    return [
      {
        submissionId: submission.id,
        status: toSignupStatus(submission.status),
        createdAt: submission.createdAt,
        isLegacy: false,
        signerEmail: asString(answers.email),
        singlePayment: submission.singlePayment,
        firstHalfPaid: submission.firstHalfPaid,
        secondHalfPaid: submission.secondHalfPaid,
        firstHalfMethod: toPaymentMethod(submission.firstHalfMethod),
        secondHalfMethod: toPaymentMethod(submission.secondHalfMethod),
        confirmationMarkedSent: submission.confirmationMarkedSent,
        paymentReminderSent: submission.paymentReminderSent,
        adminNote: submission.adminNote,
        guestBookkeeping,
        amountDue: amountDue(booking, guestBookkeeping),
        mailsTracked: submission.mailsTracked,
        mails: submission.mails.flatMap(toSentSignupMail),
        booking,
      },
    ];
  });

  const legacy = legacyRows.map((row): SignupBooking => {
    const booking = legacyBooking(row, prices, t);
    return {
      submissionId: row.id,
      status: "confirmed",
      createdAt: row.createdAt,
      isLegacy: true,
      signerEmail: row.email,
      // pre-form signups have no bookkeeping; the page doesn't offer it
      singlePayment: false,
      firstHalfPaid: false,
      secondHalfPaid: false,
      firstHalfMethod: "twint",
      secondHalfMethod: "twint",
      confirmationMarkedSent: null,
      paymentReminderSent: false,
      adminNote: "",
      guestBookkeeping: [EMPTY_GUEST_BOOKKEEPING],
      amountDue: booking.total,
      mailsTracked: false,
      mails: [],
      booking,
    };
  });

  return [...legacy, ...bookings].sort(
    (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
  );
}

/**
 * What a party pays after each person's share of their price, in CHF.
 * Someone cancelled on their own pays nothing. Added up in Rappen, so custom
 * amounts don't leave a float's rounding behind.
 */
function amountDue(
  booking: BookingSummary,
  guestBookkeeping: readonly GuestBookkeeping[],
): number {
  const rappen = booking.guests.reduce((sum, guest, guestIndex) => {
    const bookkeeping = guestBookkeeping[guestIndex] ?? EMPTY_GUEST_BOOKKEEPING;
    if (bookkeeping.cancelledAt) return sum;
    return (
      sum +
      chfToRappen(
        priceAfterShare(
          guest.price,
          bookkeeping.priceShare,
          bookkeeping.customPrice,
        ),
      )
    );
  }, 0);
  return rappen / 100;
}

/** The stored rows laid out by guest; a guest without a row has nothing yet. */
function perGuest(
  guests: number,
  rows: readonly {
    guestIndex: number;
    arrivedAt: Date | null;
    donationRappen: number | null;
    donationMethod: string;
    priceShare: string;
    customPriceRappen: number | null;
    helper: boolean;
    cancelledAt: Date | null;
  }[],
): GuestBookkeeping[] {
  const byIndex = new Map(rows.map((row) => [row.guestIndex, row]));

  return Array.from({ length: guests }, (_, index): GuestBookkeeping => {
    const row = byIndex.get(index);
    if (!row) return EMPTY_GUEST_BOOKKEEPING;
    return {
      arrivedAt: row.arrivedAt,
      donation: row.donationRappen,
      donationMethod: toPaymentMethod(row.donationMethod),
      priceShare: toPriceShare(row.priceShare),
      customPrice: row.customPriceRappen,
      helper: row.helper,
      cancelledAt: row.cancelledAt,
    };
  });
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
    restrictions: restrictionsAnswer(row.restrictions),
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
