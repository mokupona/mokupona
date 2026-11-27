import {
  CheckIcon,
  DownloadIcon,
  LockIcon,
  LockOpenIcon,
  TriangleAlertIcon,
} from "lucide-react";
import type { Logger } from "pino";
import { Fragment, useEffect, useId, useRef, useState } from "react";
import { data, Form, useFetcher, useNavigation } from "react-router";

import type { Route } from "./+types/admin.events.$eventId_.signups";

import { AdminPageHeader } from "~/components/admin-ui";
import { BackLink } from "~/components/section";
import { Button, buttonVariants } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { Textarea } from "~/components/ui/textarea";
import {
  requestLoggerContext,
  userContext,
} from "~/features/auth/middleware.server";
import { formatAdminTimestamp } from "~/features/events/date-format";
import { isPastEvent } from "~/features/events/event-status";
import { guestMailCopyTo } from "~/features/mail/mail.server";
import {
  bookingPrices,
  type BookingGuest,
  type SummaryRow,
} from "~/features/signup-form/booking-summary";
import {
  getSignupBookingsForEvent,
  type SignupBooking,
} from "~/features/signup-form/bookings.server";
import {
  EMPTY_GUEST_BOOKKEEPING,
  MAX_ADMIN_NOTE_LENGTH,
  type GuestBookkeeping,
} from "~/features/signup-form/bookkeeping";
import {
  defaultPaymentReminderCopy,
  MAX_SIGNUP_MAIL_MESSAGE_LENGTH,
  MAX_SIGNUP_MAIL_SUBJECT_LENGTH,
  signupMailPlaceholderList,
  unknownSignupMailPlaceholders,
  type SignupMailCopy,
  type SignupMailKind,
} from "~/features/signup-form/confirmation-mail";
import {
  sendPaymentReminders,
  sendSignupMessage,
  sendStoredSignupMail,
  SIGNUP_MESSAGE_REPLY_TO,
} from "~/features/signup-form/confirmation-mail.server";
import {
  summarizeHeadcount,
  type HeadcountSummary,
} from "~/features/signup-form/headcount";
import { isPaymentReminderDue } from "~/features/signup-form/payment-reminders";
import {
  amountReceived,
  chfToRappen,
  halfPrice,
  isPaymentMethod,
  isPriceShare,
  MAX_CUSTOM_PRICE_RAPPEN,
  MAX_DONATION_RAPPEN,
  MAX_RECEIVED_RAPPEN,
  MAX_TWINT_FEE_FIXED_RAPPEN,
  MAX_TWINT_FEE_PERCENT,
  parseChfInput,
  parsePercentInput,
  partyPayments,
  PAYMENT_METHOD_LABELS,
  PAYMENT_METHODS,
  priceAfterShare,
  PRICE_SHARE_LABELS,
  PRICE_SHARES,
  rappenToInput,
  summarizeMoneyReceived,
  type MoneyReceived,
  type PaymentMethod,
  type PartyPayment,
  type PaymentParty,
  type PriceShare,
  type TwintFees,
} from "~/features/signup-form/payments";
import {
  formatCHF,
  formatRappen,
  summarizeRevenue,
  type RevenueSummary,
} from "~/features/signup-form/revenue";
import {
  confirmationMailState,
  messageRecipients,
  type ConfirmationMailState,
  type MessageRecipient,
  type SentSignupMail,
  type SignupMailRecordKind,
} from "~/features/signup-form/signup-mails";
import {
  seatsLeft,
  type SignupStatus,
} from "~/features/signup-form/signup-status";
import { getText } from "~/features/site-text/site-text.server";
import { cn } from "~/lib/utils";
import {
  DuplicateSignupError,
  getSeatCounts,
  LastGuestError,
  setSignupGuestCancelled,
  SignupNotFoundError,
  updateSignupBookkeeping,
  updateSignupGuest,
  updateSignupStatus,
} from "~/models/event-signup.server";
import {
  getEventById,
  setEventPaymentReminderCopy,
  setEventSignupsClosed,
  setEventTwintFees,
} from "~/models/event.server";
import { getSignupMailState } from "~/models/signup-mail.server";
import { getDomainUrl, requireFound } from "~/shared/http.server";
import { redirectWithToast, type ToastInput } from "~/utils/toast.server";

interface Party {
  submissionId: string;
  status: SignupStatus;
  /** Rows from before signup forms: shown, but their status is fixed. */
  isLegacy: boolean;
  name: string;
  email: string;
  /** Everyone signed up in the party, helpers and cancelled people too. */
  size: number;
  /** The people in it cancelled on their own; the rest still come. */
  cancelled: number;
  /** The people still in it ticked as helpers. */
  helpers: number;
  /** The seats it takes: everyone still in it but the helpers. */
  seats: number;
  /**
   * What the whole party pays, in CHF: each person's price after the share
   * an admin set for them (all of it, half, nothing, or an amount they
   * typed in), and nothing for anyone cancelled on their own.
   */
  total: number;
  /** What the party would pay if everyone paid in full, in CHF. */
  fullTotal: number;
  createdAt: Date;
  /**
   * The signer first, then their friends, each with their answers and the
   * price they signed up at, before any share.
   */
  guests: BookingGuest[];
  /** Answers that belong to the signup as a whole. */
  contact: SummaryRow[];
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
   * Admin bookkeeping: what actually came in for each payment, in Rappen,
   * when it wasn't the amount asked for; null when it was.
   */
  firstHalfReceived: number | null;
  secondHalfReceived: number | null;
  /** Admin bookkeeping: whether the party was reminded to pay. */
  paymentReminderSent: boolean;
  /** Admin bookkeeping: free text for the team, never shown to the guest. */
  adminNote: string;
  /** Admin bookkeeping per person, in the order of `guests`. */
  guestBookkeeping: GuestBookkeeping[];
  /**
   * Whether the mail the signup's status calls for has gone out, by the
   * site's records or an admin's mark.
   */
  confirmation: ConfirmationMailState;
  /** False when the site didn't keep track of this signup's mails. */
  mailsTracked: boolean;
  /** Every mail on record for this signup, oldest first. */
  mails: SentSignupMail[];
  /** Who in the party an admin can write to. */
  recipients: MessageRecipient[];
}

function toParty(signup: SignupBooking): Party {
  const { guests, contact, total: fullTotal } = signup.booking;
  const cancelled = signup.guestBookkeeping.filter(
    (guest) => guest.cancelledAt,
  ).length;
  const helpers = signup.guestBookkeeping.filter(
    (guest) => guest.helper && !guest.cancelledAt,
  ).length;

  return {
    submissionId: signup.submissionId,
    status: signup.status,
    isLegacy: signup.isLegacy,
    name: guests[0]?.name ?? "",
    email: signup.signerEmail,
    size: guests.length,
    cancelled,
    helpers,
    seats: guests.length - cancelled - helpers,
    total: signup.amountDue,
    fullTotal,
    createdAt: signup.createdAt,
    guests,
    contact,
    singlePayment: signup.singlePayment,
    firstHalfPaid: signup.firstHalfPaid,
    secondHalfPaid: signup.secondHalfPaid,
    firstHalfMethod: signup.firstHalfMethod,
    secondHalfMethod: signup.secondHalfMethod,
    firstHalfReceived: signup.firstHalfReceived,
    secondHalfReceived: signup.secondHalfReceived,
    paymentReminderSent: signup.paymentReminderSent,
    adminNote: signup.adminNote,
    guestBookkeeping: signup.guestBookkeeping,
    // pre-form signups can't be mailed from here: their rows hold no form
    // to rebuild the mail from
    confirmation: signup.isLegacy
      ? { kind: "none", last: null }
      : confirmationMailState({
          status: signup.status,
          mailsTracked: signup.mailsTracked,
          mails: signup.mails,
          markedSent: signup.confirmationMarkedSent,
        }),
    mailsTracked: signup.mailsTracked,
    mails: signup.mails,
    recipients: signup.isLegacy
      ? []
      : messageRecipients(guests, signup.signerEmail),
  };
}

/** Whether one person in a party was cancelled on their own. */
function isCancelled(
  party: Pick<Party, "guestBookkeeping">,
  guestIndex: number,
): boolean {
  return party.guestBookkeeping[guestIndex]?.cancelledAt != null;
}

/** What share of their price one person in a party pays. */
function shareOf(
  party: Pick<Party, "guestBookkeeping">,
  guestIndex: number,
): PriceShare {
  return party.guestBookkeeping[guestIndex]?.priceShare ?? "full";
}

/**
 * What one person in a party pays, in CHF: their price after their share,
 * and nothing once they're cancelled on their own.
 */
function priceOf(
  party: Pick<Party, "guestBookkeeping">,
  guest: BookingGuest,
  guestIndex: number,
): number {
  const bookkeeping =
    party.guestBookkeeping[guestIndex] ?? EMPTY_GUEST_BOOKKEEPING;
  if (bookkeeping.cancelledAt) return 0;
  return priceAfterShare(
    guest.price,
    bookkeeping.priceShare,
    bookkeeping.customPrice,
  );
}

/** A party as the money received reads it: its ticked payments and donations. */
function toPaymentParty(party: Party): PaymentParty {
  return {
    status: party.status,
    total: party.total,
    singlePayment: party.singlePayment,
    firstHalf: {
      paid: party.firstHalfPaid,
      method: party.firstHalfMethod,
      received: party.firstHalfReceived,
    },
    secondHalf: {
      paid: party.secondHalfPaid,
      method: party.secondHalfMethod,
      received: party.secondHalfReceived,
    },
    donations: party.guestBookkeeping.map((guest) => ({
      amount: guest.donation,
      method: guest.donationMethod,
    })),
  };
}

export async function loader({ params }: Route.LoaderArgs) {
  const { eventId } = params;

  const event = await getEventById(eventId).then(requireFound);
  const prices = bookingPrices(event);
  const twintFees: TwintFees = {
    percent: event.twintFeePercent,
    fixedRappen: event.twintFeeFixedRappen,
  };
  const t = await getText();

  const [bookings, seats] = await Promise.all([
    getSignupBookingsForEvent(eventId, prices, t),
    getSeatCounts(eventId),
  ]);

  // oldest first, so the waiting list reads in the order people joined
  const parties = bookings.map(toParty);
  const reminderDefaults = defaultPaymentReminderCopy(t);

  return {
    event: {
      title: event.title,
      slots: event.slots,
      // null while the event page takes signups
      signupsClosedAt: event.signupsClosedAt,
      // a past event takes no signups anyway, so there's nothing to close
      past: isPastEvent(event.date, new Date()),
    },
    seats: { ...seats, left: seatsLeft(event.slots, seats.confirmed) },
    parties,
    revenue: summarizeRevenue(
      parties.map((party) => ({
        status: party.status,
        // helpers and anyone cancelled on their own take no seat, so they
        // don't count as people here
        people: party.seats,
        total: party.total,
      })),
    ),
    // pre-form signups have no bookkeeping to add up
    money: summarizeMoneyReceived(
      parties.filter((party) => !party.isLegacy).map(toPaymentParty),
      twintFees,
    ),
    twintFees,
    headcount: summarizeHeadcount(
      parties.map((party) => ({
        status: party.status,
        guests: party.guests.map((guest, guestIndex) => ({
          isStudent: guest.isStudent,
          vegetarian: guest.vegetarian,
          arrived: party.guestBookkeeping[guestIndex]?.arrivedAt != null,
          priceShare: shareOf(party, guestIndex),
          helper: party.guestBookkeeping[guestIndex]?.helper ?? false,
          cancelled: isCancelled(party, guestIndex),
        })),
      })),
    ),
    mail: { copyTo: guestMailCopyTo(), replyTo: SIGNUP_MESSAGE_REPLY_TO },
    reminder: {
      subject: event.paymentReminderMailSubject ?? reminderDefaults.subject,
      message: event.paymentReminderMailMessage ?? reminderDefaults.message,
      // false while it's the site-wide reminder, edited under Texts
      ownCopy:
        event.paymentReminderMailSubject !== null ||
        event.paymentReminderMailMessage !== null,
      // the groups the reminder would go to, oldest signup first
      due: bookings.filter(isPaymentReminderDue).map((signup) => ({
        submissionId: signup.submissionId,
        name: signup.booking.guests[0]?.name ?? signup.signerEmail,
        signedUpAt: signup.createdAt,
        // what the reminder asks for: the first half, in Rappen
        firstHalf: halfPrice(signup.amountDue),
      })),
    },
  };
}

/** The intents that only touch the admin's bookkeeping on a signup. */
const BOOKKEEPING_INTENTS = [
  "payments",
  "note",
  "confirmation-mark",
  "reminder",
] as const;

type BookkeepingIntent = (typeof BOOKKEEPING_INTENTS)[number];

function isBookkeepingIntent(value: unknown): value is BookkeepingIntent {
  return (
    typeof value === "string" &&
    (BOOKKEEPING_INTENTS as readonly string[]).includes(value)
  );
}

function readBookkeeping(
  intent: BookkeepingIntent,
  formData: FormData,
): Parameters<typeof updateSignupBookkeeping>[0]["data"] | { error: string } {
  switch (intent) {
    case "payments": {
      // a half the form leaves out (the second, while the party pays in one
      // payment) stays as it was, ready for when it pays in halves again;
      // the form sends each half's method with its tick, so a method
      // that's missing is a half that wasn't there
      const firstHalfMethod = readMethod(formData, "firstHalfMethod");
      const secondHalfMethod = readMethod(formData, "secondHalfMethod");
      const firstHalfPaid = formData.has("firstHalfPaid");
      const secondHalfPaid = formData.has("secondHalfPaid");
      const firstHalfReceivedRappen = readReceived(
        formData,
        "firstHalfReceived",
        firstHalfPaid,
      );
      const secondHalfReceivedRappen = readReceived(
        formData,
        "secondHalfReceived",
        secondHalfPaid,
      );
      if (
        firstHalfReceivedRappen === undefined ||
        secondHalfReceivedRappen === undefined
      ) {
        return { error: "Enter what came in, in francs, like 90 or 42.50." };
      }
      return {
        singlePayment: formData.has("singlePayment"),
        ...(firstHalfMethod && {
          firstHalfPaid,
          firstHalfMethod,
          firstHalfReceivedRappen,
        }),
        ...(secondHalfMethod && {
          secondHalfPaid,
          secondHalfMethod,
          secondHalfReceivedRappen,
        }),
      };
    }
    case "note":
      return { adminNote: readNote(formData) };
    case "confirmation-mark":
      return { confirmationMarkedSent: formData.has("sent") };
    case "reminder":
      return { paymentReminderSent: formData.has("paymentReminderSent") };
  }
}

/**
 * What came in for a payment, in Rappen, as an admin typed it next to its
 * tick; null when the field is empty or left out (the amount asked for came
 * in), and always null for a payment that isn't ticked. undefined when it
 * can't be read.
 */
function readReceived(
  formData: FormData,
  name: string,
  paid: boolean,
): number | null | undefined {
  if (!paid) return null;
  const amount = parseChfInput(String(formData.get(name) ?? ""));
  if (amount != null && amount > MAX_RECEIVED_RAPPEN) return undefined;
  return amount;
}

/** A payment method from the form; left out, it stays as it was. */
function readMethod(
  formData: FormData,
  name: string,
): PaymentMethod | undefined {
  const value = formData.get(name);
  if (value === null) return undefined;
  if (!isPaymentMethod(value)) {
    throw new Response("Bad Request", { status: 400 });
  }
  return value;
}

function readGuestIndex(formData: FormData): number {
  const value = formData.get("guest");
  // a missing field isn't the signer
  const index =
    typeof value === "string" && value.trim() !== "" ? Number(value) : NaN;
  if (!Number.isInteger(index) || index < 0) {
    throw new Response("Bad Request", { status: 400 });
  }
  return index;
}

/** The intents that touch the bookkeeping of one person in a signup. */
const GUEST_INTENTS = ["arrival", "donation", "price-share", "helper"] as const;

type GuestIntent = (typeof GUEST_INTENTS)[number];

function isGuestIntent(value: unknown): value is GuestIntent {
  return (
    typeof value === "string" &&
    (GUEST_INTENTS as readonly string[]).includes(value)
  );
}

/**
 * A person's arrival, donation or share of their price (with the amount, when
 * it's one an admin typed in), checked before anything is stored.
 */
function readGuestUpdate(
  intent: GuestIntent,
  formData: FormData,
): Parameters<typeof updateSignupGuest>[0]["data"] | { error: string } {
  if (intent === "arrival") {
    return { arrivedAt: formData.has("arrived") ? new Date() : null };
  }
  if (intent === "helper") {
    return { helper: formData.has("helper") };
  }
  if (intent === "price-share") {
    const priceShare = formData.get("priceShare");
    if (!isPriceShare(priceShare)) {
      throw new Response("Bad Request", { status: 400 });
    }
    if (priceShare !== "custom") return { priceShare };

    const amount = parseChfInput(String(formData.get("amount") ?? ""));
    if (amount == null || amount > MAX_CUSTOM_PRICE_RAPPEN) {
      return { error: "Enter what they pay in francs, like 30 or 32.50." };
    }
    return { priceShare, customPriceRappen: amount };
  }

  const amount = parseChfInput(String(formData.get("amount") ?? ""));
  if (amount === undefined || (amount ?? 0) > MAX_DONATION_RAPPEN) {
    return { error: "Enter an amount in francs, like 10 or 7.50." };
  }
  return {
    donationRappen: amount,
    donationMethod: readMethod(formData, "method"),
  };
}

function readTwintFees(formData: FormData): TwintFees | { error: string } {
  const percent = parsePercentInput(String(formData.get("percent") ?? ""));
  const fixedRappen = parseChfInput(String(formData.get("fixed") ?? ""));

  if (percent == null || percent > MAX_TWINT_FEE_PERCENT) {
    return {
      error: `Enter the share TWINT keeps, from 0 to ${MAX_TWINT_FEE_PERCENT} %, like 1.5.`,
    };
  }
  if (fixedRappen == null || fixedRappen > MAX_TWINT_FEE_FIXED_RAPPEN) {
    return {
      error: `Enter the fixed fee in francs, from 0 to ${formatRappen(MAX_TWINT_FEE_FIXED_RAPPEN)}, like 0.30.`,
    };
  }
  return { percent, fixedRappen };
}

const STATUS_BY_INTENT = {
  confirm: "confirmed",
  waitlist: "waitlisted",
  cancel: "cancelled",
} as const satisfies Record<string, SignupStatus>;

function isIntent(value: unknown): value is keyof typeof STATUS_BY_INTENT {
  return (
    typeof value === "string" &&
    Object.prototype.hasOwnProperty.call(STATUS_BY_INTENT, value)
  );
}

export async function action({ params, request, context }: Route.ActionArgs) {
  const { eventId } = params;
  const log = context.get(requestLoggerContext);
  const user = context.get(userContext);
  const page = `/admin/events/${eventId}/signups`;

  const formData = await request.formData();
  const intent = formData.get("intent");

  // the payment ticks, the mail ticks and the note are the admin's own
  // bookkeeping; they don't touch the seats, so they skip the status rules
  // below
  if (isBookkeepingIntent(intent)) {
    const bookkeepingId = readSubmissionId(formData);
    const update = readBookkeeping(intent, formData);
    if ("error" in update) {
      return data({ error: update.error }, { status: 400 });
    }

    try {
      await updateSignupBookkeeping({
        eventId,
        submissionId: bookkeepingId,
        data: update,
      });
    } catch (reason) {
      if (reason instanceof SignupNotFoundError) {
        throw new Response("Not Found", { status: 404 });
      }
      throw reason;
    }

    log.info(
      {
        userId: user.id,
        event: eventId,
        submission: bookkeepingId,
        changed: Object.keys(update),
      },
      "Admin updated a signup's bookkeeping",
    );

    return data({ saved: intent });
  }

  // a person's arrival and donation, ticked and noted during the dinner, the
  // share of their price they pay, and whether they're a helper
  if (isGuestIntent(intent)) {
    const submissionId = readSubmissionId(formData);
    const guestIndex = readGuestIndex(formData);
    const update = readGuestUpdate(intent, formData);
    if ("error" in update) {
      return data({ error: update.error }, { status: 400 });
    }

    try {
      await updateSignupGuest({
        eventId,
        submissionId,
        guestIndex,
        data: update,
      });
    } catch (reason) {
      if (reason instanceof SignupNotFoundError) {
        throw new Response("Not Found", { status: 404 });
      }
      throw reason;
    }

    log.info(
      {
        userId: user.id,
        event: eventId,
        submission: submissionId,
        guest: guestIndex,
        changed: Object.keys(update),
      },
      "Admin updated a guest's bookkeeping",
    );

    return data({ saved: intent });
  }

  // one person in a group dropping out, or coming back, while the rest of
  // the group keeps its place
  if (intent === "cancel-guest" || intent === "restore-guest") {
    const submissionId = readSubmissionId(formData);
    const guestIndex = readGuestIndex(formData);
    const cancelled = intent === "cancel-guest";

    let result: Awaited<ReturnType<typeof setSignupGuestCancelled>>;
    try {
      result = await setSignupGuestCancelled({
        eventId,
        submissionId,
        guestIndex,
        cancelled,
      });
    } catch (reason) {
      if (reason instanceof SignupNotFoundError) {
        throw new Response("Not Found", { status: 404 });
      }
      if (reason instanceof LastGuestError) {
        return redirectWithToast(page, {
          type: "error",
          title: "Nobody else is left in this group",
          description: "Cancel the whole signup instead.",
        });
      }
      throw reason;
    }

    if (!result.changed) {
      return redirectWithToast(page, { title: "Nothing changed" });
    }

    log.info(
      {
        userId: user.id,
        event: eventId,
        submission: submissionId,
        guest: guestIndex,
        cancelled,
      },
      cancelled
        ? "Admin cancelled one person in a signup"
        : "Admin brought back a person cancelled from a signup",
    );

    return redirectWithToast(page, guestCancelToast(cancelled, result.status));
  }

  // the event page stops taking signups, waiting list included, or takes
  // them again; nobody already signed up is touched
  if (intent === "close-signups" || intent === "reopen-signups") {
    requireFound(await getEventById(eventId));
    const closed = intent === "close-signups";
    await setEventSignupsClosed(eventId, closed);

    log.info(
      { userId: user.id, event: eventId, closed },
      closed
        ? "Admin closed the event's signups"
        : "Admin reopened the event's signups",
    );

    return redirectWithToast(
      page,
      closed
        ? {
            type: "success",
            title: "Signups closed",
            description:
              "The event page takes no new signups or waiting-list entries. Everyone already signed up keeps their place.",
          }
        : {
            type: "success",
            title: "Signups reopened",
            description: "The event page takes signups again.",
          },
    );
  }

  if (intent === "twint-fees") {
    const fees = readTwintFees(formData);
    if ("error" in fees) {
      return data({ error: fees.error }, { status: 400 });
    }

    await setEventTwintFees(eventId, fees);

    log.info(
      { userId: user.id, event: eventId, fees },
      "Admin set the event's TWINT fees",
    );

    return data({ saved: intent });
  }

  if (
    intent === "reminder-copy" ||
    intent === "reminder-reset" ||
    intent === "send-reminders"
  ) {
    return reminderAction({
      intent,
      eventId,
      formData,
      origin: getDomainUrl(request),
      userId: user.id,
      log,
    });
  }

  if (intent === "send-confirmation") {
    const submissionId = readSubmissionId(formData);
    const signup = await getSignupMailState({ eventId, submissionId });
    if (!signup) throw new Response("Not Found", { status: 404 });

    // read again here, so a stale page or a second click can't mail twice
    const confirmation = confirmationMailState(signup);
    if (confirmation.kind === "none") {
      return redirectWithToast(page, {
        type: "error",
        title: "This signup is cancelled",
        description: "Restore it first if they should get a confirmation.",
      });
    }
    if (confirmation.kind === "sent") {
      return redirectWithToast(page, {
        title: "Already sent",
        description: `${MAIL_NAMES[confirmation.mail]} went out on ${formatAdminTimestamp(confirmation.sentAt)}.`,
      });
    }
    if (confirmation.kind === "marked") {
      return redirectWithToast(page, {
        title: "Already marked as sent",
        description: `Untick "${MAIL_NAMES[confirmation.mail]} sent" first if it should go out from here.`,
      });
    }

    try {
      await sendStoredSignupMail({
        submissionId,
        status: confirmation.mail,
        origin: getDomainUrl(request),
        sentById: user.id,
      });
    } catch (error) {
      log.error(
        { event: eventId, submission: submissionId, error },
        "Failed to send a signup mail from the signup sheet",
      );
      return redirectWithToast(page, {
        type: "error",
        title: "The email failed",
        description: "Nothing was sent. The error is in the logs.",
      });
    }

    log.info(
      {
        userId: user.id,
        event: eventId,
        submission: submissionId,
        mail: confirmation.mail,
      },
      "Admin sent a signup's mail from the signup sheet",
    );

    return redirectWithToast(page, {
      type: "success",
      title: `${MAIL_NAMES[confirmation.mail]} sent`,
      description:
        "We've emailed the person who signed up, and each friend they gave an address for.",
    });
  }

  if (intent === "message") {
    const submissionId = readSubmissionId(formData);
    const signup = await getSignupMailState({ eventId, submissionId });
    if (!signup) throw new Response("Not Found", { status: 404 });

    const draft = readMessageDraft(formData);
    if ("error" in draft) {
      return data({ messageError: draft.error }, { status: 400 });
    }

    let result: Awaited<ReturnType<typeof sendSignupMessage>>;
    try {
      result = await sendSignupMessage({
        submissionId,
        ...draft,
        origin: getDomainUrl(request),
        sentById: user.id,
      });
    } catch (error) {
      log.error(
        { event: eventId, submission: submissionId, error },
        "Failed to send a message from the signup sheet",
      );
      return data(
        {
          messageError: "The email couldn't be sent. The error is in the logs.",
        },
        { status: 500 },
      );
    }

    if (result.sent.length === 0 && result.failed.length === 0) {
      return data(
        { messageError: "Pick at least one person to write to." },
        { status: 400 },
      );
    }

    log.info(
      {
        userId: user.id,
        event: eventId,
        submission: submissionId,
        sent: result.sent.length,
        failed: result.failed.length,
      },
      "Admin wrote to a signup from the signup sheet",
    );

    return data({
      messageResult: {
        sent: result.sent.map((recipient) => recipient.name),
        failed: result.failed.map((recipient) => recipient.name),
      },
    });
  }

  const submissionId = formData.get("submissionId");
  if (!isIntent(intent) || typeof submissionId !== "string") {
    throw new Response("Bad Request", { status: 400 });
  }
  const status = STATUS_BY_INTENT[intent];

  let previous: SignupStatus;
  try {
    ({ previous } = await updateSignupStatus({
      eventId,
      submissionId,
      status,
    }));
  } catch (reason) {
    if (reason instanceof SignupNotFoundError) {
      throw new Response("Not Found", { status: 404 });
    }
    if (reason instanceof DuplicateSignupError) {
      return redirectWithToast(page, {
        type: "error",
        title: "This signup can't be restored",
        description:
          "The same email address has signed up again since. Cancel the newer signup first.",
      });
    }
    throw reason;
  }

  if (previous === status) {
    return redirectWithToast(page, { title: "Nothing changed" });
  }

  log.info(
    {
      userId: user.id,
      event: eventId,
      submission: submissionId,
      from: previous,
      to: status,
    },
    "Admin changed a signup's status",
  );

  let mailFailed = false;
  if (status === "confirmed") {
    try {
      await sendStoredSignupMail({
        submissionId,
        status: "confirmed",
        origin: getDomainUrl(request),
        sentById: user.id,
      });
    } catch (error) {
      mailFailed = true;
      log.error(
        { event: eventId, submission: submissionId, error },
        "Failed to send the seat confirmed mail",
      );
    }
  }

  return redirectWithToast(page, statusToast(status, previous, mailFailed));
}

/**
 * The payment reminder: saving what an admin wrote for it, going back to the
 * site-wide one, or sending it to the groups picked that are due one (which
 * saves what was sent, too).
 */
async function reminderAction({
  intent,
  eventId,
  formData,
  origin,
  userId,
  log,
}: {
  intent: "reminder-copy" | "reminder-reset" | "send-reminders";
  eventId: string;
  formData: FormData;
  origin: string;
  userId: string;
  log: Logger;
}) {
  await getEventById(eventId).then(requireFound);

  if (intent === "reminder-reset") {
    await setEventPaymentReminderCopy(eventId, {
      subject: null,
      message: null,
    });
    log.info(
      { userId, event: eventId },
      "Admin set the event back to the site-wide payment reminder",
    );
    return data({ saved: intent });
  }

  const copy = readMailCopy(formData);
  if ("error" in copy) {
    return data({ reminderError: copy.error }, { status: 400 });
  }
  // the groups the admin picked to remind this time
  const picked = formData
    .getAll("group")
    .filter((value): value is string => typeof value === "string");
  if (intent === "send-reminders" && picked.length === 0) {
    return data(
      { reminderError: "Pick at least one group to remind." },
      { status: 400 },
    );
  }

  // the site-wide text, left as it is, stays the site-wide text: an edit to
  // it under Texts still reaches this event
  const defaults = defaultPaymentReminderCopy(await getText());
  await setEventPaymentReminderCopy(eventId, {
    subject: copy.subject === defaults.subject ? null : copy.subject,
    message: copy.message === defaults.message ? null : copy.message,
  });

  if (intent === "reminder-copy") {
    log.info({ userId, event: eventId }, "Admin saved the payment reminder");
    return data({ saved: intent });
  }

  let result: Awaited<ReturnType<typeof sendPaymentReminders>>;
  try {
    result = await sendPaymentReminders({
      eventId,
      submissionIds: picked,
      copy,
      origin,
      sentById: userId,
    });
  } catch (error) {
    log.error(
      { event: eventId, error },
      "Failed to send the payment reminders",
    );
    return data(
      {
        reminderError:
          "The reminders couldn't be sent. The error is in the logs.",
      },
      { status: 500 },
    );
  }

  if (result.sent.length === 0 && result.failed.length === 0) {
    return data(
      {
        reminderError:
          "None of the groups you picked is due a reminder any more.",
      },
      { status: 400 },
    );
  }

  log.info(
    {
      userId,
      event: eventId,
      sent: result.sent.length,
      failed: result.failed.length,
    },
    "Admin sent the payment reminders",
  );

  return data({ reminderResult: result });
}

const MAIL_NAMES: Record<SignupMailKind, string> = {
  confirmed: "Confirmation",
  waitlisted: "Waiting-list email",
};

function readSubmissionId(formData: FormData): string {
  const submissionId = formData.get("submissionId");
  if (typeof submissionId !== "string" || !submissionId) {
    throw new Response("Bad Request", { status: 400 });
  }
  return submissionId;
}

/** An admin's message to a party, checked before anything goes out. */
function readMessageDraft(
  formData: FormData,
):
  | { subject: string; message: string; guestIndexes: number[] }
  | { error: string } {
  const guestIndexes = formData
    .getAll("recipient")
    .map(Number)
    .filter((index) => Number.isInteger(index) && index >= 0);

  if (guestIndexes.length === 0) {
    return { error: "Pick at least one person to write to." };
  }
  const copy = readMailCopy(formData);
  if ("error" in copy) return copy;

  return { ...copy, guestIndexes };
}

/**
 * The subject and Markdown message of a mail an admin wrote (a message, the
 * payment reminder), checked before anything is stored or sent.
 */
function readMailCopy(formData: FormData): SignupMailCopy | { error: string } {
  const field = (name: string) => {
    const value = formData.get(name);
    // a textarea sends its line breaks as \r\n
    return typeof value === "string"
      ? value.replace(/\r\n?/g, "\n").trim()
      : "";
  };
  const subject = field("subject");
  const message = field("message");

  if (!subject) return { error: "The email needs a subject." };
  if (subject.length > MAX_SIGNUP_MAIL_SUBJECT_LENGTH) {
    return {
      error: `Keep the subject to ${MAX_SIGNUP_MAIL_SUBJECT_LENGTH} characters.`,
    };
  }
  if (!message) return { error: "The email needs a message." };
  if (message.length > MAX_SIGNUP_MAIL_MESSAGE_LENGTH) {
    return {
      error: `Keep the message to ${MAX_SIGNUP_MAIL_MESSAGE_LENGTH} characters.`,
    };
  }
  // a typo'd placeholder would reach the guest as a literal "{nmae}"
  const unknown = unknownSignupMailPlaceholders(`${subject}\n${message}`);
  if (unknown.length > 0) {
    return {
      error: `Unknown placeholder ${unknown.join(", ")}. Available: ${signupMailPlaceholderList()}.`,
    };
  }

  return { subject, message };
}

function readNote(formData: FormData): string {
  const note = formData.get("note");
  if (typeof note !== "string" || note.length > MAX_ADMIN_NOTE_LENGTH) {
    throw new Response("Bad Request", { status: 400 });
  }
  return note.trim();
}

function statusToast(
  status: SignupStatus,
  previous: SignupStatus,
  mailFailed: boolean,
): ToastInput {
  switch (status) {
    case "confirmed":
      return mailFailed
        ? {
            type: "error",
            title: "Seat confirmed, but the email failed",
            description:
              "Please let them know yourself. The error is in the logs.",
          }
        : {
            type: "success",
            title: "Seat confirmed",
            description: "We've emailed them that their seat is confirmed.",
          };
    case "waitlisted":
      return {
        title: "Moved to the waiting list",
        description: "They haven't been emailed.",
      };
    case "cancelled":
      return {
        title: "Signup cancelled",
        description:
          previous === "confirmed"
            ? "Their seats are free again. They haven't been emailed."
            : "They haven't been emailed.",
      };
  }
}

function guestCancelToast(
  cancelled: boolean,
  status: SignupStatus,
): ToastInput {
  if (cancelled) {
    return {
      title: "Cancelled one person in the group",
      description:
        status === "confirmed"
          ? "Their seat is free again; the rest of the group keeps theirs. Nobody has been emailed."
          : "The rest of the group keeps its place. Nobody has been emailed.",
    };
  }
  return {
    title: "Back in the group",
    description:
      status === "confirmed"
        ? "They take a seat again. They haven't been emailed."
        : "They haven't been emailed.",
  };
}

// the sheet is used at the door during the dinner, so it takes the whole
// window to show as much of the list at once as it can
export const handle = { wideLayout: "full" };

export const meta: Route.MetaFunction = ({ loaderData }) => {
  return [
    {
      title: loaderData
        ? `Admin - Event - ${loaderData.event.title} - Signups`
        : "Admin - Event - Signups",
    },
  ];
};

const SECTIONS: { status: SignupStatus; title: string; empty: string }[] = [
  { status: "confirmed", title: "Confirmed", empty: "No confirmed seats yet." },
  {
    status: "waitlisted",
    title: "Waiting list",
    empty: "Nobody is waiting.",
  },
  { status: "cancelled", title: "Cancelled", empty: "" },
];

export default function EventSignupsPage({ loaderData }: Route.ComponentProps) {
  const {
    event,
    seats,
    parties,
    revenue,
    money,
    twintFees,
    headcount,
    mail,
    reminder,
  } = loaderData;
  const waitingGroups = parties.filter(
    (party) => party.status === "waitlisted",
  ).length;
  const mailsDue = parties.filter(
    (party) => party.confirmation.kind === "due",
  ).length;
  const overbookedBy = seats.confirmed - event.slots;
  const arrived = headcount.confirmed.arrived + headcount.waitlisted.arrived;
  const helpers = headcount.confirmed.helpers;
  // the sheet narrowed to the people who wrote a dietary restriction
  const [onlyRestrictions, setOnlyRestrictions] = useState(false);
  const withRestrictions = parties
    .filter((party) => party.status !== "cancelled")
    .reduce(
      (sum, party) =>
        sum +
        party.guests.filter((guest, guestIndex) =>
          hasRestrictions(party, guest, guestIndex),
        ).length,
      0,
    );

  return (
    <main className="animate-page-in">
      <BackLink to="/admin/events" prefetch="intent">
        Events
      </BackLink>

      <AdminPageHeader
        eyebrow={[
          `${seats.confirmed} / ${event.slots} seats confirmed`,
          ...(helpers > 0 ? [helperCount(helpers)] : []),
          ...(seats.waitlisted > 0 ? [`${seats.waitlisted} waiting`] : []),
          ...(arrived > 0 ? [`${arrived} arrived`] : []),
        ].join(" · ")}
        title={event.title}
        actions={
          <>
            {event.past ? null : (
              <SignupsToggle closed={event.signupsClosedAt !== null} />
            )}
            <a
              href="signups.csv"
              className={buttonVariants({ variant: "outline" })}
            >
              <DownloadIcon className="size-4" />
              Export CSV
            </a>
          </>
        }
      />

      {event.signupsClosedAt && !event.past ? (
        <SignupsClosedNotice closedAt={event.signupsClosedAt} />
      ) : null}

      <RevenueSummary revenue={revenue} money={money} />

      <div className="mb-8 grid gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <MoneyReceivedSummary money={money} fees={twintFees} />
        <div className="flex flex-col gap-6">
          <Headcount headcount={headcount} />
          <DietaryRestrictions
            parties={parties}
            onShowOnSheet={() => {
              setOnlyRestrictions(true);
              document
                .getElementById(SIGNUP_LISTS_ID)
                ?.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
          />
        </div>
      </div>

      <PaymentReminder reminder={reminder} mail={mail} />

      {overbookedBy > 0 ? (
        <Notice>
          This event is overbooked by {overbookedBy}{" "}
          {overbookedBy === 1 ? "seat" : "seats"}.
        </Notice>
      ) : seats.left > 0 && waitingGroups > 0 ? (
        <Notice>
          {seats.left} {seats.left === 1 ? "seat is" : "seats are"} free and{" "}
          {waitingGroups} {waitingGroups === 1 ? "group is" : "groups are"}{" "}
          waiting. Confirming a group emails them that their seat is confirmed.
        </Notice>
      ) : null}

      {mailsDue > 0 ? (
        <Notice>
          {mailsDue} {mailsDue === 1 ? "group has" : "groups have"} no
          confirmation email on record. You can send it from the Emails column,
          or tick it there if it went out another way.
        </Notice>
      ) : null}

      <div
        id={SIGNUP_LISTS_ID}
        className="mb-4 flex scroll-mt-4 flex-wrap items-center gap-3 text-sm"
      >
        <label className="inline-flex items-center gap-2">
          <input
            type="checkbox"
            checked={onlyRestrictions}
            onChange={(event) =>
              setOnlyRestrictions(event.currentTarget.checked)
            }
            className="accent-primary size-4"
          />
          Only people with dietary restrictions ({withRestrictions})
        </label>
      </div>

      <div className="flex flex-col gap-6">
        {SECTIONS.map(({ status, title, empty }) => {
          const rows = parties.filter((party) => party.status === status);
          if (status === "cancelled" && rows.length === 0) return null;
          const total = rows.reduce((sum, party) => sum + party.total, 0);
          const guests = rows.reduce((sum, party) => sum + party.seats, 0);
          const helpers = rows.reduce((sum, party) => sum + party.helpers, 0);
          // people cancelled on their own; in a cancelled group, everyone is
          const cancelled =
            status === "cancelled"
              ? 0
              : rows.reduce((sum, party) => sum + party.cancelled, 0);

          return (
            <section key={status} aria-labelledby={`signups-${status}`}>
              <h2
                id={`signups-${status}`}
                className="mb-3 text-lg font-semibold"
              >
                {title}{" "}
                <span className="text-muted-foreground text-sm font-normal">
                  {rows.length} {rows.length === 1 ? "group" : "groups"}
                  {` · ${guestCount(guests)}`}
                  {helpers > 0 ? ` · ${helperCount(helpers)}` : null}
                  {cancelled > 0 ? ` · ${cancelled} cancelled` : null}
                  {status === "cancelled" ? null : ` · ${formatCHF(total)}`}
                </span>
              </h2>
              <PartyTable
                parties={rows}
                seatsLeft={seats.left}
                emptyText={
                  onlyRestrictions
                    ? "Nobody here wrote a dietary restriction."
                    : empty
                }
                mail={mail}
                onlyRestrictions={onlyRestrictions}
              />
            </section>
          );
        })}
      </div>
    </main>
  );
}

const SIGNUPS_TOGGLE_INTENTS = ["close-signups", "reopen-signups"];

/** Closes the event's signups on the event page, or opens them again. */
function SignupsToggle({ closed }: { closed: boolean }) {
  const navigation = useNavigation();
  const intent = navigation.formData?.get("intent");
  const busy =
    navigation.state !== "idle" &&
    typeof intent === "string" &&
    SIGNUPS_TOGGLE_INTENTS.includes(intent);

  return (
    <Form method="post">
      <Button
        type="submit"
        name="intent"
        value={closed ? "reopen-signups" : "close-signups"}
        variant="outline"
        disabled={busy}
      >
        {closed ? (
          <LockOpenIcon className="size-4" />
        ) : (
          <LockIcon className="size-4" />
        )}
        {closed ? "Reopen signups" : "Close signups"}
      </Button>
    </Form>
  );
}

function SignupsClosedNotice({ closedAt }: { closedAt: Date }) {
  const date = new Date(closedAt);

  return (
    <Notice>
      <span className="font-semibold">Signups are closed</span> since{" "}
      <time dateTime={date.toISOString()} suppressHydrationWarning>
        {formatAdminTimestamp(date)}
      </time>
      . The event page takes no new signups, not even for the waiting list.
      Everyone on this sheet keeps their place, and you can still confirm, move
      and cancel groups here.
    </Notice>
  );
}

function RevenueSummary({
  revenue,
  money,
}: {
  revenue: RevenueSummary;
  money: MoneyReceived;
}) {
  return (
    <section aria-labelledby="revenue-heading" className="mb-6">
      <h2 id="revenue-heading" className="sr-only">
        Expected revenue
      </h2>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="Expected revenue"
          value={formatCHF(revenue.confirmedTotal)}
          note={`From ${guestCount(revenue.confirmedPeople)} with a confirmed seat`}
          emphasis
        />
        <Stat
          label="Received so far"
          value={formatRappen(money.net)}
          note={
            money.twintFees > 0
              ? `${formatRappen(money.gross)} came in, less ${formatRappen(money.twintFees)} in TWINT fees`
              : money.gross > 0
                ? "Prices and donations ticked so far, no TWINT fees"
                : "Nothing ticked as paid yet"
          }
          emphasis
        />
        <Stat
          label="Waiting list"
          value={formatCHF(revenue.waitlistTotal)}
          note={
            revenue.waitlistPeople === 0
              ? "Nobody is waiting"
              : `What ${guestCount(revenue.waitlistPeople)} would pay if every group got a seat`
          }
        />
        <Stat
          label="Per person"
          value={
            revenue.averagePerPerson === null
              ? "—"
              : formatCHF(revenue.averagePerPerson)
          }
          note="Average over confirmed guests (helpers left out), at the price each pays"
        />
      </div>
    </section>
  );
}

function MoneyReceivedSummary({
  money,
  fees,
}: {
  money: MoneyReceived;
  fees: TwintFees;
}) {
  const { payments, donations } = money;
  const rows = [
    {
      label: "Prices paid",
      twint: payments.twint,
      cash: payments.cash,
    },
    {
      label: "Donations",
      twint: donations.twint,
      cash: donations.cash,
    },
    {
      label: "Came in",
      twint: payments.twint + donations.twint,
      cash: payments.cash + donations.cash,
      strong: true,
    },
  ];

  return (
    <section aria-labelledby="money-heading">
      <h2 id="money-heading" className="mb-3 text-lg font-semibold">
        Money received
      </h2>
      <Card>
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>What</TableHead>
              <TableHead className="text-right">TWINT</TableHead>
              <TableHead className="text-right">Cash</TableHead>
              <TableHead className="text-right">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.label} className="hover:bg-transparent">
                <TableCell
                  className={cn("py-2", row.strong && "font-semibold")}
                >
                  {row.label}
                </TableCell>
                <MoneyCell amount={row.twint} strong={row.strong} />
                <MoneyCell amount={row.cash} strong={row.strong} />
                <MoneyCell amount={row.twint + row.cash} strong={row.strong} />
              </TableRow>
            ))}
            <TableRow className="hover:bg-transparent">
              <TableCell className="py-2">
                TWINT fees
                <span className="text-muted-foreground">
                  {" "}
                  · {money.twintTransactions}{" "}
                  {money.twintTransactions === 1 ? "payment" : "payments"}
                </span>
              </TableCell>
              <MoneyCell amount={-money.twintFees} />
              <TableCell className="text-muted-foreground py-2 text-right">
                —
              </TableCell>
              <MoneyCell amount={-money.twintFees} />
            </TableRow>
            <TableRow className="hover:bg-transparent">
              <TableCell className="py-2 font-semibold">What we keep</TableCell>
              <MoneyCell
                amount={payments.twint + donations.twint - money.twintFees}
                strong
              />
              <MoneyCell amount={payments.cash + donations.cash} strong />
              <MoneyCell amount={money.net} strong emphasis />
            </TableRow>
          </TableBody>
        </Table>
        <div className="flex flex-col gap-4 border-t p-4">
          <p className="text-sm">
            {money.outstandingParties === 0 ? (
              "Every confirmed group has paid in full."
            ) : (
              <>
                Still to come:{" "}
                <span className="font-semibold tabular-nums">
                  {formatRappen(money.outstanding)}
                </span>
                , still owed by {money.outstandingParties} confirmed{" "}
                {money.outstandingParties === 1 ? "group" : "groups"}.
              </>
            )}
          </p>
          <TwintFeesForm fees={fees} />
        </div>
      </Card>
    </section>
  );
}

function MoneyCell({
  amount,
  strong = false,
  emphasis = false,
}: {
  amount: number;
  strong?: boolean;
  emphasis?: boolean;
}) {
  return (
    <TableCell
      className={cn(
        "py-2 text-right whitespace-nowrap tabular-nums",
        strong && "font-semibold",
        emphasis && "text-primary",
      )}
    >
      {amount < 0 ? `−${formatRappen(-amount)}` : formatRappen(amount)}
    </TableCell>
  );
}

function TwintFeesForm({ fees }: { fees: TwintFees }) {
  const fetcher = useFetcher<typeof action>();
  const id = useId();
  const busy = fetcher.state !== "idle";
  const reply = fetcher.state === "idle" ? fetcher.data : undefined;
  const error = reply && "error" in reply ? reply.error : null;
  const saved =
    reply !== undefined && "saved" in reply && reply.saved === "twint-fees";

  return (
    <fetcher.Form method="post" className="flex flex-col gap-2">
      <input type="hidden" name="intent" value="twint-fees" />
      <p className="text-sm font-semibold">TWINT fees for this event</p>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <label htmlFor={`${id}-percent`} className="sr-only">
          Share TWINT keeps of each payment, in percent
        </label>
        <Input
          id={`${id}-percent`}
          key={`percent-${fees.percent}`}
          name="percent"
          defaultValue={String(fees.percent)}
          inputMode="decimal"
          required
          className="h-9 w-20 text-right tabular-nums"
        />
        <span>% of each payment, plus</span>
        <label htmlFor={`${id}-fixed`} className="sr-only">
          Fixed fee per payment, in CHF
        </label>
        <Input
          id={`${id}-fixed`}
          key={`fixed-${fees.fixedRappen}`}
          name="fixed"
          defaultValue={rappenToInput(fees.fixedRappen)}
          inputMode="decimal"
          required
          className="h-9 w-20 text-right tabular-nums"
        />
        <span>CHF</span>
        <Button type="submit" size="sm" variant="outline" disabled={busy}>
          {busy ? "Saving…" : "Save fees"}
        </Button>
        {saved ? (
          <span role="status" className="text-muted-foreground">
            Saved
          </span>
        ) : null}
      </div>
      {error ? (
        <p role="alert" className="text-destructive-light text-sm">
          {error}
        </p>
      ) : null}
      <p className="text-muted-foreground text-xs">
        Each half ticked as paid by TWINT, each price paid in full by TWINT and
        each donation by TWINT counts as one payment. Cash costs nothing.
      </p>
    </fetcher.Form>
  );
}

interface ReminderSettings {
  /** What the reminder says now: the event's own, or the site-wide one. */
  subject: string;
  message: string;
  /** False while the event uses the site-wide reminder. */
  ownCopy: boolean;
  /** The groups that are due one, oldest signup first. */
  due: {
    submissionId: string;
    name: string;
    signedUpAt: Date;
    /** In Rappen. */
    firstHalf: number;
  }[];
}

/**
 * The payment reminder: who's due one, and the email itself, written here
 * and sent in one go to the groups picked. Every group that's due starts out
 * picked; a group that only just signed up can be left for later.
 */
function PaymentReminder({
  reminder,
  mail,
}: {
  reminder: ReminderSettings;
  mail: MailSettings;
}) {
  const [open, setOpen] = useState(false);
  const fetcher = useFetcher<typeof action>();
  const id = useId();
  const busy = fetcher.state !== "idle";
  const sending = busy && fetcher.formData?.get("intent") === "send-reminders";
  const reply = fetcher.state === "idle" ? fetcher.data : undefined;
  const result =
    reply && "reminderResult" in reply ? reply.reminderResult : undefined;
  const error = reply && "reminderError" in reply ? reply.reminderError : null;
  const saved =
    reply !== undefined &&
    "saved" in reply &&
    (reply.saved === "reminder-copy" || reply.saved === "reminder-reset");
  const count = reminder.due.length;
  const groups = `${count} ${count === 1 ? "group" : "groups"}`;
  // the groups left out of this round; a group that becomes due later
  // starts out picked
  const [skipped, setSkipped] = useState<ReadonlySet<string>>(new Set());
  const picked = reminder.due.filter(
    (party) => !skipped.has(party.submissionId),
  );
  const pickedGroups = `${picked.length} ${picked.length === 1 ? "group" : "groups"}`;
  // the fields start over from what's saved once it changes
  const copyKey = `${reminder.subject}\n${reminder.message}`;

  return (
    <section aria-labelledby="reminder-heading" className="mb-8">
      <h2 id="reminder-heading" className="mb-3 text-lg font-semibold">
        Payment reminder
      </h2>
      <Card className="flex flex-col gap-4 p-4">
        <p className="text-sm">
          {count === 0 ? (
            "No group is due a reminder: every confirmed group has paid its 1st half, has been reminded, or has nothing to pay."
          ) : (
            <>
              <span className="font-semibold">{groups}</span> with a confirmed
              seat {count === 1 ? "hasn't" : "haven't"} paid the 1st half and{" "}
              {count === 1 ? "hasn't" : "haven't"} been reminded yet:{" "}
              {listNames(reminder.due.map((party) => party.name))}.
            </>
          )}
        </p>

        {open ? (
          <fetcher.Form method="post" className="flex flex-col gap-3">
            {count > 0 ? (
              <fieldset className="flex flex-col gap-1">
                <legend className="mb-1 flex w-full flex-wrap items-baseline gap-x-3 text-sm font-semibold">
                  Send to
                  <span className="flex gap-2 text-xs font-normal">
                    <button
                      type="button"
                      onClick={() => setSkipped(new Set())}
                      className="text-primary hover:underline"
                    >
                      All
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setSkipped(
                          new Set(
                            reminder.due.map((party) => party.submissionId),
                          ),
                        )
                      }
                      className="text-primary hover:underline"
                    >
                      None
                    </button>
                  </span>
                </legend>
                {reminder.due.map((party) => (
                  <label
                    key={party.submissionId}
                    className="inline-flex flex-wrap items-center gap-x-2 text-sm"
                  >
                    <input
                      type="checkbox"
                      name="group"
                      value={party.submissionId}
                      checked={!skipped.has(party.submissionId)}
                      onChange={(event) => {
                        const { checked } = event.currentTarget;
                        setSkipped((current) => {
                          const next = new Set(current);
                          if (checked) next.delete(party.submissionId);
                          else next.add(party.submissionId);
                          return next;
                        });
                      }}
                      className="accent-primary size-4"
                    />
                    {party.name}
                    <span className="text-muted-foreground text-xs">
                      signed up{" "}
                      <time
                        dateTime={new Date(party.signedUpAt).toISOString()}
                        suppressHydrationWarning
                      >
                        {formatAdminTimestamp(new Date(party.signedUpAt))}
                      </time>{" "}
                      · {formatRappen(party.firstHalf)} now
                    </span>
                  </label>
                ))}
              </fieldset>
            ) : null}

            <div className="flex flex-col gap-1">
              <label
                htmlFor={`${id}-subject`}
                className="text-sm font-semibold"
              >
                Subject
              </label>
              <Input
                key={copyKey}
                id={`${id}-subject`}
                name="subject"
                defaultValue={reminder.subject}
                required
                maxLength={MAX_SIGNUP_MAIL_SUBJECT_LENGTH}
              />
            </div>

            <div className="flex flex-col gap-1">
              <label
                htmlFor={`${id}-message`}
                className="text-sm font-semibold"
              >
                Message
              </label>
              <Textarea
                key={copyKey}
                id={`${id}-message`}
                name="message"
                defaultValue={reminder.message}
                required
                rows={8}
                maxLength={MAX_SIGNUP_MAIL_MESSAGE_LENGTH}
              />
              <p className="text-muted-foreground text-xs">
                Each group gets one email, to the person who signed it up, with
                a button to the event page under your message. Once it&apos;s
                out, the group is ticked as reminded. Markdown works: [link
                text](https://…), **bold**, *italic*. Placeholders:{" "}
                {signupMailPlaceholderList()}; {"{total}"} and {"{half}"} are
                what the group pays, after anyone set to pay half or nothing.
                Replies go to {mail.replyTo}.
                {mail.copyTo
                  ? ` A copy of each email goes to ${mail.copyTo}.`
                  : null}{" "}
                {reminder.ownCopy
                  ? "This event has its own reminder text."
                  : "This is the site-wide reminder text, from Texts → Emails; saving a change keeps it for this event only."}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button
                type="submit"
                name="intent"
                value="send-reminders"
                size="sm"
                disabled={busy || picked.length === 0}
                onClick={(clickEvent) => {
                  const ok = window.confirm(
                    `Send the payment reminder to ${pickedGroups}? Each one is ticked as reminded once it's out.`,
                  );
                  if (!ok) clickEvent.preventDefault();
                }}
              >
                {sending ? "Sending…" : `Send to ${pickedGroups}`}
              </Button>
              <Button
                type="submit"
                name="intent"
                value="reminder-copy"
                size="sm"
                variant="outline"
                disabled={busy}
              >
                Save text
              </Button>
              {reminder.ownCopy ? (
                <Button
                  type="submit"
                  name="intent"
                  value="reminder-reset"
                  size="sm"
                  variant="outline"
                  formNoValidate
                  disabled={busy}
                >
                  Use the site-wide text
                </Button>
              ) : null}
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setOpen(false)}
              >
                Close
              </Button>
              {saved ? (
                <span role="status" className="text-muted-foreground text-sm">
                  Saved
                </span>
              ) : null}
              {error ? (
                <span role="alert" className="text-destructive-light text-sm">
                  {error}
                </span>
              ) : null}
            </div>
          </fetcher.Form>
        ) : (
          <div>
            <Button
              type="button"
              size="sm"
              variant={count > 0 ? "default" : "outline"}
              onClick={() => setOpen(true)}
            >
              {count > 0 ? "Write and send the reminder" : "Edit the reminder"}
            </Button>
          </div>
        )}

        {result ? (
          <p role="status" className="text-sm">
            {result.sent.length > 0
              ? `Reminded ${listNames(result.sent)}.`
              : null}
            {result.failed.length > 0
              ? ` Couldn't email ${listNames(result.failed)}; ${result.failed.length === 1 ? "they're" : "they're all"} still due, and the error is in the logs.`
              : null}
          </p>
        ) : null}
      </Card>
    </section>
  );
}

/** What a person wrote under dietary restrictions, marked so it stands out. */
function RestrictionsNote({ restrictions }: { restrictions: string }) {
  return (
    <span className="border-destructive-light/40 bg-destructive/5 text-destructive-light inline-flex max-w-72 items-start gap-1 border px-1.5 py-0.5 text-xs font-semibold whitespace-normal">
      <TriangleAlertIcon className="mt-px size-3.5 shrink-0" aria-hidden />
      <span className="break-words">
        <span className="sr-only">Dietary restrictions: </span>
        {restrictions}
      </span>
    </span>
  );
}

/**
 * Whether one person in a party wrote a dietary restriction the kitchen
 * should know about: someone cancelled on their own won't be eating.
 */
function hasRestrictions(
  party: Party,
  guest: BookingGuest,
  guestIndex: number,
): boolean {
  return guest.restrictions !== null && !isCancelled(party, guestIndex);
}

/**
 * Everyone with a seat or on the waiting list who wrote a dietary
 * restriction, at a glance: for the kitchen, and for a check at the door.
 */
function DietaryRestrictions({
  parties,
  onShowOnSheet,
}: {
  parties: Party[];
  /** Narrows the signup lists below to these people. */
  onShowOnSheet: () => void;
}) {
  // confirmed seats first, then the waiting list, each in signup order
  const people = (["confirmed", "waitlisted"] as const).flatMap((status) =>
    parties
      .filter((party) => party.status === status)
      .flatMap((party) =>
        party.guests.flatMap((guest, guestIndex) =>
          guest.restrictions && hasRestrictions(party, guest, guestIndex)
            ? [
                {
                  party,
                  guest,
                  guestIndex,
                  restrictions: guest.restrictions,
                },
              ]
            : [],
        ),
      ),
  );

  return (
    <section aria-labelledby="restrictions-heading">
      <h2 id="restrictions-heading" className="mb-3 text-lg font-semibold">
        Dietary restrictions{" "}
        <span className="text-muted-foreground text-sm font-normal">
          {people.length} {people.length === 1 ? "person" : "people"}
        </span>
      </h2>
      <Card>
        {people.length === 0 ? (
          <p className="text-muted-foreground p-4 text-sm">
            Nobody with a seat or on the waiting list has written a dietary
            restriction.
          </p>
        ) : (
          <>
            <ul className="divide-y">
              {people.map(({ party, guest, guestIndex, restrictions }) => {
                const about = [
                  party.guestBookkeeping[guestIndex]?.helper ? "helper" : null,
                  guest.vegetarian === true ? "vegetarian" : null,
                  guestIndex === 0 ? null : `with ${party.name}`,
                  party.status === "waitlisted" ? "waiting list" : null,
                ].filter(Boolean);

                return (
                  <li
                    key={`${party.submissionId}-${guestIndex}`}
                    className="flex flex-col gap-1 px-4 py-2.5 sm:flex-row sm:items-start sm:gap-4"
                  >
                    <div className="flex min-w-32 flex-col sm:w-40 sm:shrink-0">
                      <span className="font-semibold">{guest.name}</span>
                      {about.length > 0 ? (
                        <span className="text-muted-foreground text-xs">
                          {about.join(" · ")}
                        </span>
                      ) : null}
                    </div>
                    <RestrictionsNote restrictions={restrictions} />
                  </li>
                );
              })}
            </ul>
            <div className="border-t p-3">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={onShowOnSheet}
              >
                Show only them on the sheet
              </Button>
            </div>
          </>
        )}
      </Card>
    </section>
  );
}

function Headcount({ headcount }: { headcount: HeadcountSummary }) {
  const { confirmed, waitlisted } = headcount;

  const anyHelpers = confirmed.helpers + waitlisted.helpers > 0;

  const rows = [
    {
      label: "Guests",
      confirmed: confirmed.guests,
      waitlisted: waitlisted.guests,
      strong: true,
    },
    ...(anyHelpers
      ? [
          {
            label: "Helpers",
            confirmed: confirmed.helpers,
            waitlisted: waitlisted.helpers,
            strong: true,
          },
        ]
      : []),
    {
      label: "Arrived",
      confirmed: confirmed.arrived,
      waitlisted: waitlisted.arrived,
      strong: true,
    },
    {
      label: "Vegetarian",
      confirmed: confirmed.vegetarian,
      waitlisted: waitlisted.vegetarian,
    },
    {
      label: "Not vegetarian",
      confirmed: confirmed.notVegetarian,
      waitlisted: waitlisted.notVegetarian,
    },
    ...(confirmed.dietNotAsked + waitlisted.dietNotAsked > 0
      ? [
          {
            label: "Diet not asked on this form",
            confirmed: confirmed.dietNotAsked,
            waitlisted: waitlisted.dietNotAsked,
          },
        ]
      : []),
    {
      label: "Students",
      confirmed: confirmed.students,
      waitlisted: waitlisted.students,
    },
    {
      label: "Not students",
      confirmed: confirmed.notStudents,
      waitlisted: waitlisted.notStudents,
    },
    ...(confirmed.paysHalf + waitlisted.paysHalf > 0
      ? [
          {
            label: "Paying half",
            confirmed: confirmed.paysHalf,
            waitlisted: waitlisted.paysHalf,
          },
        ]
      : []),
    ...(confirmed.paysNothing + waitlisted.paysNothing > 0
      ? [
          {
            label: "Not paying",
            confirmed: confirmed.paysNothing,
            waitlisted: waitlisted.paysNothing,
          },
        ]
      : []),
    ...(confirmed.paysCustom + waitlisted.paysCustom > 0
      ? [
          {
            label: "Paying a custom amount",
            confirmed: confirmed.paysCustom,
            waitlisted: waitlisted.paysCustom,
          },
        ]
      : []),
  ];

  return (
    <section aria-labelledby="headcount-heading">
      <h2 id="headcount-heading" className="mb-3 text-lg font-semibold">
        Headcount
      </h2>
      <Card>
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Who</TableHead>
              <TableHead className="text-right">Confirmed</TableHead>
              <TableHead className="text-right">Waiting list</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.label} className="hover:bg-transparent">
                <TableCell
                  className={cn("py-2", row.strong && "font-semibold")}
                >
                  {row.label}
                </TableCell>
                <TableCell
                  className={cn(
                    "py-2 text-right tabular-nums",
                    row.strong && "font-semibold",
                  )}
                >
                  {row.confirmed}
                </TableCell>
                <TableCell className="text-muted-foreground py-2 text-right tabular-nums">
                  {row.waitlisted}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {anyHelpers ? (
          <p className="text-muted-foreground border-t px-4 py-3 text-xs">
            Helpers take no seat. They&apos;re counted in the rows from Arrived
            down, since they eat with everyone.
          </p>
        ) : null}
      </Card>
    </section>
  );
}

function guestCount(count: number) {
  return `${count} ${count === 1 ? "guest" : "guests"}`;
}

function helperCount(count: number) {
  return `${count} ${count === 1 ? "helper" : "helpers"}`;
}

function Stat({
  label,
  value,
  note,
  emphasis = false,
}: {
  label: string;
  value: string;
  note: string;
  emphasis?: boolean;
}) {
  return (
    <Card className="flex flex-col gap-1 p-4 md:p-5">
      <span className="text-muted-foreground text-xs font-semibold tracking-widest uppercase">
        {label}
      </span>
      <span
        className={cn(
          "text-2xl font-semibold tabular-nums",
          emphasis && "text-primary",
        )}
      >
        {value}
      </span>
      <span className="text-muted-foreground text-sm">{note}</span>
    </Card>
  );
}

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <p
      role="status"
      className="border-primary/35 bg-primary/10 mb-6 rounded-xl border px-4 py-3 text-sm"
    >
      {children}
    </p>
  );
}

/** Where a guest's reply lands, and where the team's copies go. */
interface MailSettings {
  copyTo: string | null;
  replyTo: string;
}

const TABLE_COLUMNS = 10;

// one row per person: the person's own cells, then the party's cells, which
// span all of the party's rows
const CELL = "px-3 py-2 align-top";

// the line under a party's last row: heavier than the dashed lines between
// its people, so each signup reads as one block
const PARTY_END = "border-b-3 border-foreground/45";

// where the filter sits above the lists, for the restrictions card to jump to
const SIGNUP_LISTS_ID = "signup-lists";

function PartyTable({
  parties: allParties,
  seatsLeft,
  emptyText,
  mail,
  onlyRestrictions,
}: {
  parties: Party[];
  seatsLeft: number;
  emptyText: string;
  mail: MailSettings;
  /** Shows only the people who wrote a dietary restriction. */
  onlyRestrictions: boolean;
}) {
  const parties = onlyRestrictions
    ? allParties.filter((party) =>
        party.guests.some((guest, guestIndex) =>
          hasRestrictions(party, guest, guestIndex),
        ),
      )
    : allParties;

  // the table scrolls sideways on a phone rather than being cut off
  return (
    <Card>
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="px-3 text-center">Arrived</TableHead>
            <TableHead className="px-3">Guest</TableHead>
            <TableHead className="px-3 text-right">
              Price
              <span className="block font-normal tracking-normal normal-case">
                full · half
              </span>
            </TableHead>
            <TableHead className="px-3">Donation</TableHead>
            <TableHead className="border-l px-3 text-center">Party</TableHead>
            <TableHead className="px-3 text-right">
              Group price
              <span className="block font-normal tracking-normal normal-case">
                full · half
              </span>
            </TableHead>
            <TableHead className="px-3">Payments</TableHead>
            <TableHead className="px-3">Emails</TableHead>
            <TableHead className="px-3 text-right">Signed up</TableHead>
            <TableHead className="px-3 text-right">
              <span className="sr-only">Actions</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {parties.map((party) => (
            <PartyRows
              key={party.submissionId}
              party={party}
              seatsLeft={seatsLeft}
              mail={mail}
              onlyRestrictions={onlyRestrictions}
            />
          ))}
          {parties.length === 0 ? (
            <TableRow className="hover:bg-transparent">
              <TableCell
                colSpan={TABLE_COLUMNS}
                className="text-muted-foreground py-8 text-center text-sm"
              >
                {emptyText}
              </TableCell>
            </TableRow>
          ) : null}
        </TableBody>
      </Table>
    </Card>
  );
}

function PartyRows({
  party,
  seatsLeft,
  mail,
  onlyRestrictions,
}: {
  party: Party;
  seatsLeft: number;
  mail: MailSettings;
  onlyRestrictions: boolean;
}) {
  const [open, setOpen] = useState(false);
  const detailsId = `party-${party.submissionId}`;
  // each person keeps their place in the booking, whoever is shown
  const shown = party.guests
    .map((guest, guestIndex) => ({ guest, guestIndex }))
    .filter(
      ({ guest, guestIndex }) =>
        !onlyRestrictions || hasRestrictions(party, guest, guestIndex),
    );
  const rowSpan = shown.length;
  // the party's last row closes it off, unless its details follow
  const closingRow = open ? -1 : rowSpan - 1;

  return (
    <>
      {shown.map(({ guest, guestIndex }, row) => (
        <GuestRow
          key={guestIndex}
          party={party}
          guest={guest}
          guestIndex={guestIndex}
          seatsLeft={seatsLeft}
          closesParty={row === closingRow}
          signerExtras={
            row === 0 ? (
              <>
                {guestIndex !== 0 ? (
                  // the signer is hidden by the filter: say whose group it is
                  <span className="text-muted-foreground text-xs">
                    in {party.name}&apos;s group
                  </span>
                ) : null}
                <span className="text-muted-foreground text-xs break-all">
                  {party.email}
                </span>
                {party.adminNote ? (
                  <span className="text-primary text-xs">Has a note</span>
                ) : null}
                <button
                  type="button"
                  aria-expanded={open}
                  aria-controls={detailsId}
                  onClick={() => setOpen((current) => !current)}
                  className="text-primary text-xs hover:underline"
                >
                  {open ? "Hide details" : "Show details"}
                </button>
              </>
            ) : null
          }
        >
          {row === 0 ? (
            <PartyCells party={party} rowSpan={rowSpan} seatsLeft={seatsLeft} />
          ) : null}
        </GuestRow>
      ))}
      {open ? (
        <TableRow className={cn("hover:bg-transparent", PARTY_END)}>
          <TableCell
            id={detailsId}
            colSpan={TABLE_COLUMNS}
            className="bg-foreground/[0.02] whitespace-normal"
          >
            <PartyDetails party={party} mail={mail} />
          </TableCell>
        </TableRow>
      ) : null}
    </>
  );
}

/**
 * One person's cells: their arrival, name, price and donation. Someone
 * cancelled on their own stays on the sheet, struck through, with nothing to
 * tick, so they can be brought back.
 */
function GuestRow({
  party,
  guest,
  guestIndex,
  seatsLeft,
  closesParty,
  signerExtras,
  children,
}: {
  party: Party;
  guest: BookingGuest;
  guestIndex: number;
  seatsLeft: number;
  closesParty: boolean;
  signerExtras: React.ReactNode;
  /** The party's own cells, on its first row. */
  children: React.ReactNode;
}) {
  const arrival = useFetcher();
  const arrivalId = `arrived-${party.submissionId}-${guestIndex}`;
  const bookkeeping =
    party.guestBookkeeping[guestIndex] ?? EMPTY_GUEST_BOOKKEEPING;
  const savedArrived = bookkeeping.arrivedAt !== null;
  // shows the tick at once, before the page has reloaded its data
  const arrived = arrival.formData
    ? arrival.formData.has("arrived")
    : savedArrived;
  const cancelled = bookkeeping.cancelledAt !== null;
  const own = cn(CELL, arrived && !cancelled && "bg-primary/10");
  const tags = [
    cancelled ? "cancelled" : null,
    bookkeeping.helper ? "helper" : null,
    guest.vegetarian === true ? "vegetarian" : null,
    guest.isStudent ? "student" : null,
  ].filter(Boolean);
  // the last one still in a group can only go with the whole signup
  const canCancelAlone =
    !party.isLegacy &&
    party.status !== "cancelled" &&
    (cancelled || party.size - party.cancelled > 1);

  return (
    <TableRow
      className={cn(
        "hover:bg-transparent",
        closesParty ? PARTY_END : "border-foreground/10 border-dashed",
      )}
    >
      <TableCell className={cn(own, "text-center")}>
        {party.isLegacy || cancelled ? (
          <span className="text-muted-foreground text-sm">—</span>
        ) : (
          <arrival.Form method="post" className="flex justify-center pt-0.5">
            <input type="hidden" name="intent" value="arrival" />
            <input
              type="hidden"
              name="submissionId"
              value={party.submissionId}
            />
            <input type="hidden" name="guest" value={guestIndex} />
            <input
              id={arrivalId}
              key={String(savedArrived)}
              type="checkbox"
              name="arrived"
              defaultChecked={savedArrived}
              aria-label={`${guest.name} arrived`}
              onChange={(event) => event.currentTarget.form?.requestSubmit()}
              className="accent-primary size-5"
            />
          </arrival.Form>
        )}
      </TableCell>
      <TableCell className={own}>
        <div className="flex min-w-36 flex-col items-start gap-0.5">
          {cancelled ? (
            <s
              className={cn(
                "text-muted-foreground",
                guestIndex === 0 && "font-semibold",
              )}
            >
              {guest.name}
            </s>
          ) : party.isLegacy ? (
            <span className={cn(guestIndex === 0 && "font-semibold")}>
              {guest.name}
            </span>
          ) : (
            <label
              htmlFor={arrivalId}
              className={cn(
                "cursor-pointer",
                guestIndex === 0 && "font-semibold",
              )}
            >
              {guest.name}
            </label>
          )}
          {tags.length > 0 ? (
            <span className="text-muted-foreground text-xs">
              {tags.join(" · ")}
            </span>
          ) : null}
          {guest.restrictions && !cancelled ? (
            <RestrictionsNote restrictions={guest.restrictions} />
          ) : null}
          {signerExtras}
          {party.isLegacy || cancelled ? null : (
            <HelperTick
              party={party}
              guest={guest}
              guestIndex={guestIndex}
              helper={bookkeeping.helper}
            />
          )}
          {canCancelAlone ? (
            <GuestCancelForm
              party={party}
              guest={guest}
              guestIndex={guestIndex}
              cancelled={cancelled}
              seatsLeft={seatsLeft}
            />
          ) : null}
        </div>
      </TableCell>
      <TableCell className={cn(own, "text-right")}>
        <div className="flex flex-col items-end gap-1">
          <PriceLines
            price={priceOf(party, guest, guestIndex)}
            fullPrice={guest.price}
          />
          {party.isLegacy || cancelled ? null : (
            <PriceShareForm
              // starts over from the saved share once it's stored
              key={bookkeeping.priceShare}
              party={party}
              guest={guest}
              guestIndex={guestIndex}
              bookkeeping={bookkeeping}
              price={priceOf(party, guest, guestIndex)}
            />
          )}
        </div>
      </TableCell>
      <TableCell className={own}>
        {party.isLegacy || (cancelled && bookkeeping.donation === null) ? (
          <span className="text-muted-foreground text-sm">—</span>
        ) : (
          <DonationForm
            party={party}
            guest={guest}
            guestIndex={guestIndex}
            bookkeeping={bookkeeping}
          />
        )}
      </TableCell>
      {children}
    </TableRow>
  );
}

/**
 * A price, and the half that each payment comes to, unless it's paid in one
 * payment or there's nothing to pay. A price other than `fullPrice` (someone
 * paying half, nothing, or a custom amount) shows the full one struck
 * through.
 */
function PriceLines({
  price,
  fullPrice = price,
  singlePayment = false,
}: {
  price: number;
  fullPrice?: number;
  singlePayment?: boolean;
}) {
  return (
    <div className="flex flex-col items-end whitespace-nowrap tabular-nums">
      <span>
        <span className="font-semibold">{formatCHF(price)}</span>
        {price !== fullPrice ? (
          <s className="text-muted-foreground ml-1.5 text-xs">
            <span className="sr-only">instead of </span>
            {formatCHF(fullPrice)}
          </s>
        ) : null}
      </span>
      <span className="text-muted-foreground text-xs">
        {price === 0
          ? "nothing to pay"
          : singlePayment
            ? "in 1 payment"
            : `half ${formatRappen(halfPrice(price))}`}
      </span>
    </div>
  );
}

/**
 * Whether a person is a helper: someone working the dinner, who signed up so
 * their allergies are on the sheet. A helper takes no seat and isn't counted
 * as a guest. Ticking it saves it.
 */
function HelperTick({
  party,
  guest,
  guestIndex,
  helper,
}: {
  party: Party;
  guest: BookingGuest;
  guestIndex: number;
  helper: boolean;
}) {
  const fetcher = useFetcher();

  return (
    <fetcher.Form
      method="post"
      className={cn("mt-1", fetcher.state !== "idle" && "opacity-60")}
    >
      <input type="hidden" name="intent" value="helper" />
      <input type="hidden" name="submissionId" value={party.submissionId} />
      <input type="hidden" name="guest" value={guestIndex} />
      <label className="text-muted-foreground inline-flex items-center gap-1.5 text-xs">
        <input
          key={String(helper)}
          type="checkbox"
          name="helper"
          defaultChecked={helper}
          aria-label={`${guest.name} is a helper`}
          onChange={(event) => event.currentTarget.form?.requestSubmit()}
          className="accent-primary size-3.5"
        />
        Helper
      </label>
    </fetcher.Form>
  );
}

/**
 * Cancels one person while the rest of their group keeps its place, or
 * brings them back. Bringing someone back to a confirmed group takes a seat
 * again (unless they're a helper), which may overbook the event.
 */
function GuestCancelForm({
  party,
  guest,
  guestIndex,
  cancelled,
  seatsLeft,
}: {
  party: Party;
  guest: BookingGuest;
  guestIndex: number;
  cancelled: boolean;
  seatsLeft: number;
}) {
  const takesSeat =
    party.status === "confirmed" &&
    !(party.guestBookkeeping[guestIndex]?.helper ?? false);

  return (
    <Form method="post" preventScrollReset className="mt-1">
      <input type="hidden" name="submissionId" value={party.submissionId} />
      <input type="hidden" name="guest" value={guestIndex} />
      <button
        type="submit"
        name="intent"
        value={cancelled ? "restore-guest" : "cancel-guest"}
        aria-label={
          cancelled ? `Restore ${guest.name}` : `Cancel only ${guest.name}`
        }
        onClick={(clickEvent) => {
          const question = !cancelled
            ? `Cancel only ${guest.name}? The rest of the group keeps its place, and nobody is emailed.`
            : takesSeat && seatsLeft < 1
              ? `Bringing ${guest.name} back overbooks the event by 1 seat. Bring them back anyway?`
              : null;
          if (question && !window.confirm(question)) {
            clickEvent.preventDefault();
          }
        }}
        className={cn(
          "text-xs hover:underline",
          cancelled ? "text-primary" : "text-destructive-light",
        )}
      >
        {cancelled ? "Restore" : "Cancel only them"}
      </button>
    </Form>
  );
}

/**
 * Whether a person pays their price in full, half of it, nothing (helpers,
 * who sign up so their allergies are on the sheet), or an amount an admin
 * types in. Picking a share saves it. Picking a custom amount opens a field
 * for it, filled in with what they pay now; the amount is saved when the
 * field is left, or with Enter.
 */
function PriceShareForm({
  party,
  guest,
  guestIndex,
  bookkeeping,
  price,
}: {
  party: Party;
  guest: BookingGuest;
  guestIndex: number;
  bookkeeping: GuestBookkeeping;
  /** What they pay now, in CHF. */
  price: number;
}) {
  const fetcher = useFetcher<typeof action>();
  const reply = fetcher.state === "idle" ? fetcher.data : undefined;
  const error = reply && "error" in reply ? reply.error : null;
  const share = bookkeeping.priceShare;
  // the share in the menu: a custom amount isn't saved until it has one
  const [picked, setPicked] = useState<PriceShare>(share);
  const selectRef = useRef<HTMLSelectElement>(null);
  const amountRef = useRef<HTMLInputElement>(null);
  const saved =
    share === "custom"
      ? rappenToInput(bookkeeping.customPrice)
      : rappenToInput(chfToRappen(price));

  // a custom amount just picked: straight to its field
  useEffect(() => {
    if (picked === "custom" && share !== "custom") amountRef.current?.focus();
  }, [picked, share]);

  return (
    <fetcher.Form
      method="post"
      className={cn(
        "flex flex-col items-end gap-1",
        fetcher.state !== "idle" && "opacity-60",
      )}
    >
      <input type="hidden" name="intent" value="price-share" />
      <input type="hidden" name="submissionId" value={party.submissionId} />
      <input type="hidden" name="guest" value={guestIndex} />
      <select
        ref={selectRef}
        name="priceShare"
        value={picked}
        aria-label={`What ${guest.name} pays`}
        onChange={(event) => {
          const next = event.currentTarget.value;
          if (!isPriceShare(next)) return;
          setPicked(next);
          if (next !== "custom") event.currentTarget.form?.requestSubmit();
        }}
        className={cn(
          "bg-background focus-visible:inset-ring-ring h-8 border px-1.5 text-xs focus-visible:inset-ring-2 focus-visible:outline-hidden",
          picked !== "full" && "border-primary text-primary font-semibold",
        )}
      >
        {PRICE_SHARES.map((option) => (
          <option key={option} value={option}>
            {PRICE_SHARE_LABELS[option]}
          </option>
        ))}
      </select>
      {picked === "custom" ? (
        <div className="flex items-center gap-1">
          <Input
            ref={amountRef}
            key={saved}
            name="amount"
            defaultValue={saved}
            inputMode="decimal"
            aria-label={`What ${guest.name} pays, in CHF`}
            aria-invalid={error ? true : undefined}
            onFocus={(event) => event.currentTarget.select()}
            onBlur={(event) => {
              // back to the menu to pick another share: that one is saved
              if (event.relatedTarget === selectRef.current) return;
              if (
                share !== "custom" ||
                event.currentTarget.value.trim() !== saved
              ) {
                event.currentTarget.form?.requestSubmit();
              }
            }}
            className="h-8 w-20 px-2 text-right tabular-nums"
          />
          <span className="text-muted-foreground text-xs">CHF</span>
        </div>
      ) : null}
      {error ? (
        <span role="alert" className="text-destructive-light text-xs">
          {error}
        </span>
      ) : null}
    </fetcher.Form>
  );
}

/** The party's cells, spanning all of its people's rows. */
function PartyCells({
  party,
  rowSpan,
  seatsLeft,
}: {
  party: Party;
  rowSpan: number;
  seatsLeft: number;
}) {
  // the people still in it; anyone cancelled on their own is counted apart
  const size = party.size - party.cancelled;

  return (
    <>
      <TableCell rowSpan={rowSpan} className={cn(CELL, "border-l text-center")}>
        {size}
        {party.helpers > 0 ? (
          <span className="text-muted-foreground block text-xs whitespace-nowrap">
            {party.helpers === size
              ? size === 1
                ? "helper"
                : "all helpers"
              : `incl. ${helperCount(party.helpers)}`}
          </span>
        ) : null}
        {party.cancelled > 0 ? (
          <span className="text-muted-foreground block text-xs whitespace-nowrap">
            {party.cancelled} cancelled
          </span>
        ) : null}
      </TableCell>
      <TableCell rowSpan={rowSpan} className={cn(CELL, "text-right")}>
        <PriceLines
          price={party.total}
          fullPrice={party.fullTotal}
          singlePayment={party.singlePayment}
        />
      </TableCell>
      <TableCell rowSpan={rowSpan} className={CELL}>
        <PaymentTicks party={party} />
      </TableCell>
      <TableCell rowSpan={rowSpan} className={CELL}>
        <MailTicks party={party} />
      </TableCell>
      <TableCell rowSpan={rowSpan} className={cn(CELL, "text-right")}>
        <time
          dateTime={new Date(party.createdAt).toISOString()}
          suppressHydrationWarning
          className="text-muted-foreground text-sm whitespace-nowrap"
        >
          {formatAdminTimestamp(new Date(party.createdAt))}
        </time>
      </TableCell>
      <TableCell rowSpan={rowSpan} className={cn(CELL, "text-right")}>
        {party.isLegacy ? null : (
          <PartyActions party={party} seatsLeft={seatsLeft} />
        )}
      </TableCell>
    </>
  );
}

function DonationForm({
  party,
  guest,
  guestIndex,
  bookkeeping,
}: {
  party: Party;
  guest: BookingGuest;
  guestIndex: number;
  bookkeeping: GuestBookkeeping;
}) {
  const fetcher = useFetcher<typeof action>();
  const reply = fetcher.state === "idle" ? fetcher.data : undefined;
  const error = reply && "error" in reply ? reply.error : null;
  const saved = rappenToInput(bookkeeping.donation);

  return (
    <fetcher.Form
      method="post"
      className={cn(
        "flex flex-col gap-1",
        fetcher.state !== "idle" && "opacity-60",
      )}
    >
      <input type="hidden" name="intent" value="donation" />
      <input type="hidden" name="submissionId" value={party.submissionId} />
      <input type="hidden" name="guest" value={guestIndex} />
      <div className="flex items-center gap-1">
        <Input
          key={saved}
          name="amount"
          defaultValue={saved}
          inputMode="decimal"
          aria-label={`Donation from ${guest.name}, in CHF`}
          aria-invalid={error ? true : undefined}
          // saved when the field is left, or with Enter
          onBlur={(event) => {
            if (event.currentTarget.value.trim() !== saved) {
              event.currentTarget.form?.requestSubmit();
            }
          }}
          className="h-8 w-20 px-2 text-right tabular-nums"
        />
        <span className="text-muted-foreground text-xs">CHF</span>
        <MethodSelect
          name="method"
          method={bookkeeping.donationMethod}
          label={`How ${guest.name} gave`}
        />
      </div>
      {error ? (
        <span role="alert" className="text-destructive-light text-xs">
          {error}
        </span>
      ) : null}
    </fetcher.Form>
  );
}

/** TWINT or cash; picking one saves the form it sits in. */
function MethodSelect({
  name,
  method,
  label,
}: {
  name: string;
  method: PaymentMethod;
  label: string;
}) {
  return (
    <select
      key={method}
      name={name}
      defaultValue={method}
      aria-label={label}
      onChange={(event) => event.currentTarget.form?.requestSubmit()}
      className="bg-background focus-visible:inset-ring-ring h-8 border px-1.5 text-xs focus-visible:inset-ring-2 focus-visible:outline-hidden"
    >
      {PAYMENT_METHODS.map((option) => (
        <option key={option} value={option}>
          {PAYMENT_METHOD_LABELS[option]}
        </option>
      ))}
    </select>
  );
}

function PartyDetails({ party, mail }: { party: Party; mail: MailSettings }) {
  return (
    <div className="flex flex-col gap-4 py-3">
      {party.isLegacy ? null : <NoteForm party={party} />}

      {party.isLegacy ? null : <PartyMails party={party} mail={mail} />}

      {party.contact.length > 0 ? (
        <div className="flex flex-col gap-2">
          <p className="text-muted-foreground text-xs font-semibold tracking-widest uppercase">
            Signup
          </p>
          <AnswerList rows={party.contact} />
        </div>
      ) : null}

      <div className="grid gap-3 md:grid-cols-2">
        {party.guests.map((guest, guestIndex) => (
          <GuestCard
            key={guestIndex}
            guest={guest}
            signer={guestIndex === 0}
            price={priceOf(party, guest, guestIndex)}
            share={shareOf(party, guestIndex)}
            helper={party.guestBookkeeping[guestIndex]?.helper ?? false}
            cancelled={isCancelled(party, guestIndex)}
          />
        ))}
      </div>
    </div>
  );
}

function GuestCard({
  guest,
  signer,
  price,
  share,
  helper,
  cancelled,
}: {
  guest: BookingGuest;
  signer: boolean;
  /** What they pay, in CHF, after their share. */
  price: number;
  share: PriceShare;
  helper: boolean;
  /** Cancelled on their own: they pay nothing. */
  cancelled: boolean;
}) {
  const rows: SummaryRow[] = guest.email
    ? [["Their email", guest.email], ...guest.rows]
    : guest.rows;

  return (
    <div className="bg-background border p-3">
      <div className="flex items-baseline justify-between gap-3">
        <p className="font-semibold">
          {guest.name}
          {signer ? (
            <span className="text-muted-foreground ml-2 text-xs font-normal">
              signed up
            </span>
          ) : null}
          {helper ? (
            <span className="text-muted-foreground ml-2 text-xs font-normal">
              helper
            </span>
          ) : null}
          {cancelled ? (
            <span className="text-destructive-light ml-2 text-xs font-normal">
              cancelled
            </span>
          ) : null}
        </p>
        <p className="text-sm font-semibold whitespace-nowrap tabular-nums">
          {formatCHF(price)}
          {guest.isStudent ? (
            <span className="text-muted-foreground font-normal">
              {" "}
              · student
            </span>
          ) : null}
          {share !== "full" ? (
            <span className="text-muted-foreground font-normal">
              {" "}
              · {PRICE_SHARE_LABELS[share].toLowerCase()}
            </span>
          ) : null}
        </p>
      </div>
      <div className="mt-2">
        <AnswerList rows={rows} />
      </div>
    </div>
  );
}

function AnswerList({ rows }: { rows: readonly SummaryRow[] }) {
  return (
    <dl className="grid grid-cols-[minmax(0,auto)_minmax(0,1fr)] gap-x-4 gap-y-1 text-sm">
      {rows.map(([label, value], index) => (
        <Fragment key={`${index}-${label}`}>
          <dt className="text-muted-foreground">{label}</dt>
          <dd className="break-words">{value}</dd>
        </Fragment>
      ))}
    </dl>
  );
}

function PaymentTicks({ party }: { party: Party }) {
  const fetcher = useFetcher<typeof action>();
  const reply = fetcher.state === "idle" ? fetcher.data : undefined;
  const error = reply && "error" in reply ? reply.error : null;

  if (party.isLegacy) {
    return <span className="text-muted-foreground text-sm">—</span>;
  }
  // a party of helpers who don't pay: there's no payment to tick
  if (party.total === 0) {
    return (
      <span className="text-muted-foreground text-sm">Nothing to pay</span>
    );
  }

  // shows the switch at once, before the page has reloaded its data
  const singlePayment = fetcher.formData
    ? fetcher.formData.has("singlePayment")
    : party.singlePayment;
  // what each payment asks for and what came in, as saved. An amount that
  // came in belongs to the way the party pays, so none shows while it
  // switches between halves and one payment.
  const paymentParty = toPaymentParty(party);
  const payments = partyPayments(paymentParty);
  const [first, second] = singlePayment === party.singlePayment ? payments : [];
  const received = amountReceived(paymentParty);
  const asked = chfToRappen(party.total);
  const noted =
    first !== undefined &&
    payments.some((payment) => payment.paid && payment.received != null);
  const allIn = payments.every((payment) => payment.paid);

  // the ticks are native checkboxes: a click shows at once, and each one is
  // remounted from the saved value once the page has reloaded its data. In
  // one payment, the first half's tick and method stand for the whole price.
  return (
    <fetcher.Form
      method="post"
      className={cn(
        "flex flex-col items-start gap-1 text-sm",
        fetcher.state !== "idle" && "opacity-60",
      )}
    >
      <input type="hidden" name="intent" value="payments" />
      <input type="hidden" name="submissionId" value={party.submissionId} />
      {singlePayment ? (
        <PaymentTick
          name="firstHalfPaid"
          label="Paid in full"
          checked={party.firstHalfPaid}
          methodName="firstHalfMethod"
          method={party.firstHalfMethod}
          methodLabel={`How ${party.name}'s group paid`}
          receivedName="firstHalfReceived"
          payment={first}
          receivedLabel={`What came in from ${party.name}'s group, in CHF`}
        />
      ) : (
        <>
          <PaymentTick
            name="firstHalfPaid"
            label="1st half paid"
            checked={party.firstHalfPaid}
            methodName="firstHalfMethod"
            method={party.firstHalfMethod}
            methodLabel={`How ${party.name}'s group paid the 1st half`}
            receivedName="firstHalfReceived"
            payment={first}
            receivedLabel={`What came in for ${party.name}'s group's 1st half, in CHF`}
          />
          <PaymentTick
            name="secondHalfPaid"
            label="2nd half paid"
            checked={party.secondHalfPaid}
            methodName="secondHalfMethod"
            method={party.secondHalfMethod}
            methodLabel={`How ${party.name}'s group paid the 2nd half`}
            receivedName="secondHalfReceived"
            payment={second}
            receivedLabel={`What came in for ${party.name}'s group's 2nd half, in CHF`}
          />
        </>
      )}
      {noted ? (
        <span className="text-xs whitespace-nowrap tabular-nums">
          {formatRappen(received)} of {formatCHF(party.total)} in
          {allIn && received < asked ? (
            <span className="text-destructive-light font-semibold">
              {" "}
              · {formatRappen(asked - received)} short
            </span>
          ) : null}
          {received > asked ? (
            <span className="text-muted-foreground">
              {" "}
              · {formatRappen(received - asked)} over
            </span>
          ) : null}
        </span>
      ) : null}
      {error ? (
        <span role="alert" className="text-destructive-light text-xs">
          {error}
        </span>
      ) : null}
      <label className="text-muted-foreground inline-flex items-center gap-2 text-xs whitespace-nowrap">
        <input
          key={String(party.singlePayment)}
          type="checkbox"
          name="singlePayment"
          defaultChecked={party.singlePayment}
          onChange={(event) => event.currentTarget.form?.requestSubmit()}
          className="accent-primary size-3.5"
        />
        1 payment, no halves
      </label>
    </fetcher.Form>
  );
}

/**
 * One payment's tick and how it came in. Once it's ticked, a field takes
 * what actually came in when it wasn't the amount asked for (shown greyed
 * in the empty field); emptying it goes back to the amount asked for. The
 * amount is saved when the field is left, or with Enter.
 */
function PaymentTick({
  name,
  label,
  checked,
  methodName,
  method,
  methodLabel,
  receivedName,
  payment,
  receivedLabel,
}: {
  name: string;
  label: string;
  checked: boolean;
  methodName: string;
  method: PaymentMethod;
  methodLabel: string;
  receivedName: string;
  /** The payment as saved; left out while the party switches how it pays. */
  payment: PartyPayment | undefined;
  receivedLabel: string;
}) {
  const saved = rappenToInput(payment?.received ?? null);

  return (
    <div className="flex flex-col items-start gap-1">
      <div className="flex items-center gap-2">
        <label className="inline-flex items-center gap-2 whitespace-nowrap">
          <input
            key={String(checked)}
            type="checkbox"
            name={name}
            defaultChecked={checked}
            onChange={(event) => event.currentTarget.form?.requestSubmit()}
            className="accent-primary size-4"
          />
          {label}
        </label>
        <MethodSelect name={methodName} method={method} label={methodLabel} />
      </div>
      {checked && payment ? (
        <div className="text-muted-foreground flex items-center gap-1 pl-6 text-xs">
          <span aria-hidden>came in</span>
          <Input
            key={saved}
            name={receivedName}
            defaultValue={saved}
            placeholder={rappenToInput(payment.amount)}
            inputMode="decimal"
            aria-label={receivedLabel}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                event.currentTarget.form?.requestSubmit();
              }
            }}
            onBlur={(event) => {
              if (event.currentTarget.value.trim() !== saved) {
                event.currentTarget.form?.requestSubmit();
              }
            }}
            className="h-7 w-20 px-2 text-right text-xs tabular-nums"
          />
          <span aria-hidden>CHF</span>
        </div>
      ) : null}
    </div>
  );
}

function NoteForm({ party }: { party: Party }) {
  const fetcher = useFetcher<typeof action>();
  const saved =
    fetcher.state === "idle" &&
    fetcher.data !== undefined &&
    "saved" in fetcher.data &&
    fetcher.data.saved === "note";
  const noteId = `note-${party.submissionId}`;

  return (
    <fetcher.Form method="post" className="flex flex-col gap-2">
      <input type="hidden" name="intent" value="note" />
      <input type="hidden" name="submissionId" value={party.submissionId} />
      <label htmlFor={noteId} className="text-sm font-semibold">
        Notes for us
      </label>
      <Textarea
        id={noteId}
        name="note"
        defaultValue={party.adminNote}
        rows={3}
        maxLength={MAX_ADMIN_NOTE_LENGTH}
        placeholder="Anything we have to remember about this group"
      />
      <div className="flex items-center gap-3">
        <Button
          type="submit"
          size="sm"
          variant="outline"
          disabled={fetcher.state !== "idle"}
        >
          Save note
        </Button>
        {saved ? (
          <span role="status" className="text-muted-foreground text-sm">
            Saved
          </span>
        ) : null}
      </div>
    </fetcher.Form>
  );
}

function PartyActions({
  party,
  seatsLeft,
}: {
  party: Party;
  seatsLeft: number;
}) {
  // helpers take no seat
  const overBy = party.seats - seatsLeft;

  return (
    <Form method="post" className="flex justify-end gap-2">
      <input type="hidden" name="submissionId" value={party.submissionId} />

      {party.status !== "confirmed" ? (
        <Button
          type="submit"
          name="intent"
          value="confirm"
          size="sm"
          onClick={(clickEvent) => {
            if (overBy <= 0) return;
            const ok = window.confirm(
              `Confirming ${party.name}'s group of ${party.seats} overbooks the event by ${overBy} ${overBy === 1 ? "seat" : "seats"}. Confirm anyway?`,
            );
            if (!ok) clickEvent.preventDefault();
          }}
        >
          Confirm
        </Button>
      ) : null}

      {party.status !== "waitlisted" ? (
        <Button
          type="submit"
          name="intent"
          value="waitlist"
          size="sm"
          variant="outline"
        >
          Waiting list
        </Button>
      ) : null}

      {party.status !== "cancelled" ? (
        <Button
          type="submit"
          name="intent"
          value="cancel"
          size="sm"
          variant="destructive-outline"
        >
          Cancel
        </Button>
      ) : null}
    </Form>
  );
}

const MAIL_KIND_LABELS: Record<SignupMailRecordKind, string> = {
  confirmed: "Seat confirmation",
  waitlisted: "Waiting-list email",
  friend: "Note that they were signed up",
  custom: "Message",
  reminder: "Payment reminder",
};

function SentAt({ date }: { date: Date }) {
  const sentAt = new Date(date);
  return (
    <time
      dateTime={sentAt.toISOString()}
      suppressHydrationWarning
      className="text-muted-foreground text-xs whitespace-nowrap"
    >
      {formatAdminTimestamp(sentAt)}
    </time>
  );
}

/** The confirmation and the payment reminder: whether each went out. */
function MailTicks({ party }: { party: Party }) {
  if (party.isLegacy) {
    return <span className="text-muted-foreground text-sm">—</span>;
  }

  return (
    <div className="flex flex-col items-start gap-2 text-sm">
      <ConfirmationTick party={party} />
      {party.status === "cancelled" || party.total === 0 ? null : (
        <ReminderTick party={party} />
      )}
    </div>
  );
}

function ConfirmationTick({ party }: { party: Party }) {
  const { confirmation } = party;
  const fetcher = useFetcher();

  // a cancelled signup is owed no mail; the sheet shows the last one it got
  if (confirmation.kind === "none") {
    return confirmation.last ? (
      <div className="text-muted-foreground flex flex-col items-start gap-0.5">
        <span className="whitespace-nowrap">
          {MAIL_NAMES[confirmation.last.mail]} sent
        </span>
        <SentAt date={confirmation.last.sentAt} />
      </div>
    ) : (
      <span className="text-muted-foreground">No email due</span>
    );
  }

  const sent = confirmation.kind === "sent" || confirmation.kind === "marked";
  // shows the tick at once, before the page has reloaded its data
  const ticked = fetcher.formData ? fetcher.formData.has("sent") : sent;

  return (
    <div className="flex flex-col items-start gap-1">
      <fetcher.Form method="post">
        <input type="hidden" name="intent" value="confirmation-mark" />
        <input type="hidden" name="submissionId" value={party.submissionId} />
        <label className="inline-flex items-center gap-2 whitespace-nowrap">
          <input
            key={String(sent)}
            type="checkbox"
            name="sent"
            defaultChecked={sent}
            onChange={(event) => event.currentTarget.form?.requestSubmit()}
            className="accent-primary size-4"
          />
          {MAIL_NAMES[confirmation.mail]} sent
        </label>
      </fetcher.Form>

      {confirmation.kind === "sent" ? (
        <SentAt date={confirmation.sentAt} />
      ) : confirmation.kind === "marked" ? (
        <span className="text-muted-foreground text-xs">Ticked by hand</span>
      ) : confirmation.markedNotSent ? (
        <span className="text-destructive-light text-xs whitespace-nowrap">
          Ticked as not sent
        </span>
      ) : confirmation.previous ? (
        <span className="text-destructive-light text-xs whitespace-nowrap">
          Only the {MAIL_NAMES[confirmation.previous.mail].toLowerCase()}
        </span>
      ) : confirmation.tracked ? (
        <span className="text-destructive-light text-xs font-semibold whitespace-nowrap">
          Not sent
        </span>
      ) : (
        <span
          className="text-muted-foreground text-xs whitespace-nowrap"
          title="Signed up before the site kept track of its emails, so they may have had one"
        >
          No record
        </span>
      )}

      {confirmation.kind === "due" && !ticked ? (
        <SendConfirmationButton party={party} confirmation={confirmation} />
      ) : null}
    </div>
  );
}

function ReminderTick({ party }: { party: Party }) {
  const fetcher = useFetcher();
  // mails are oldest first
  const lastReminder = party.mails
    .filter((sent) => sent.kind === "reminder")
    .at(-1);

  return (
    <div className="flex flex-col items-start gap-0.5">
      <fetcher.Form method="post">
        <input type="hidden" name="intent" value="reminder" />
        <input type="hidden" name="submissionId" value={party.submissionId} />
        <label className="inline-flex items-center gap-2 whitespace-nowrap">
          <input
            key={String(party.paymentReminderSent)}
            type="checkbox"
            name="paymentReminderSent"
            defaultChecked={party.paymentReminderSent}
            onChange={(event) => event.currentTarget.form?.requestSubmit()}
            className="accent-primary size-4"
          />
          Payment reminder sent
        </label>
      </fetcher.Form>
      {party.paymentReminderSent && lastReminder ? (
        <SentAt date={lastReminder.sentAt} />
      ) : null}
    </div>
  );
}

function SendConfirmationButton({
  party,
  confirmation,
}: {
  party: Party;
  confirmation: Extract<ConfirmationMailState, { kind: "due" }>;
}) {
  const navigation = useNavigation();
  const sending =
    navigation.state !== "idle" &&
    navigation.formData?.get("intent") === "send-confirmation" &&
    navigation.formData.get("submissionId") === party.submissionId;
  const label =
    confirmation.mail === "confirmed"
      ? "Send confirmation"
      : "Send waiting-list email";

  return (
    <Form method="post">
      <input type="hidden" name="submissionId" value={party.submissionId} />
      <Button
        type="submit"
        name="intent"
        value="send-confirmation"
        size="sm"
        variant="outline"
        disabled={sending}
        onClick={(clickEvent) => {
          // only a signup from before the tracking may already have one
          if (confirmation.tracked || confirmation.previous) return;
          const ok = window.confirm(
            `${party.name} signed up before the site kept track of its emails, so they may already have their ${MAIL_NAMES[confirmation.mail].toLowerCase()}. Send it now?`,
          );
          if (!ok) clickEvent.preventDefault();
        }}
      >
        {sending ? "Sending…" : label}
      </Button>
    </Form>
  );
}

function PartyMails({ party, mail }: { party: Party; mail: MailSettings }) {
  const [writing, setWriting] = useState(false);

  return (
    <div className="flex flex-col gap-2">
      <p className="text-muted-foreground text-xs font-semibold tracking-widest uppercase">
        Emails
      </p>
      {party.mails.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          {party.mailsTracked
            ? "No emails sent yet."
            : "No emails on record. This signup is from before the site kept track, so they may have had their confirmation all the same."}
        </p>
      ) : (
        <ul className="flex flex-col gap-2 text-sm">
          {party.mails.map((sent, mailIndex) => (
            <li key={mailIndex} className="flex flex-col gap-0.5">
              <span>
                <span className="font-semibold">
                  {MAIL_KIND_LABELS[sent.kind]}
                </span>{" "}
                to {sent.recipient}
                {sent.sentBy ? (
                  <span className="text-muted-foreground">
                    {" "}
                    · sent by {sent.sentBy}
                  </span>
                ) : null}
              </span>
              <SentAt date={sent.sentAt} />
              {sent.kind === "custom" || sent.kind === "reminder" ? (
                <details className="mt-1">
                  <summary className="cursor-pointer">
                    &ldquo;{sent.subject}&rdquo;
                  </summary>
                  <p className="bg-background mt-1 border p-2 whitespace-pre-wrap">
                    {sent.message}
                  </p>
                </details>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {writing ? (
        <MessageForm
          party={party}
          mail={mail}
          onClose={() => setWriting(false)}
        />
      ) : party.recipients.length > 0 ? (
        <div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setWriting(true)}
          >
            Write an email
          </Button>
        </div>
      ) : (
        <p className="text-muted-foreground text-sm">
          Nobody in this signup gave an email address.
        </p>
      )}
    </div>
  );
}

function MessageForm({
  party,
  mail,
  onClose,
}: {
  party: Party;
  mail: MailSettings;
  onClose: () => void;
}) {
  const fetcher = useFetcher<typeof action>();
  const formRef = useRef<HTMLFormElement>(null);
  const id = useId();
  const busy = fetcher.state !== "idle";
  const reply = fetcher.state === "idle" ? fetcher.data : undefined;
  const result =
    reply && "messageResult" in reply ? reply.messageResult : undefined;
  const error = reply && "messageError" in reply ? reply.messageError : null;

  // once every mail is out, the form is ready for the next one
  useEffect(() => {
    if (result && result.failed.length === 0) formRef.current?.reset();
  }, [result]);

  return (
    <fetcher.Form
      ref={formRef}
      method="post"
      className="bg-background flex flex-col gap-3 border p-4"
    >
      <input type="hidden" name="intent" value="message" />
      <input type="hidden" name="submissionId" value={party.submissionId} />

      <fieldset className="flex flex-col gap-1">
        <legend className="mb-1 text-sm font-semibold">To</legend>
        {party.recipients.map((recipient, recipientIndex) => (
          <label
            key={recipient.guestIndex}
            className="inline-flex items-center gap-2 text-sm"
          >
            <input
              type="checkbox"
              name="recipient"
              value={recipient.guestIndex}
              defaultChecked={recipientIndex === 0}
              className="accent-primary size-4"
            />
            {recipient.name}
            <span className="text-muted-foreground">{recipient.email}</span>
            {isCancelled(party, recipient.guestIndex) ? (
              <span className="text-muted-foreground text-xs">cancelled</span>
            ) : null}
          </label>
        ))}
      </fieldset>

      <div className="flex flex-col gap-1">
        <label htmlFor={`${id}-subject`} className="text-sm font-semibold">
          Subject
        </label>
        <Input
          id={`${id}-subject`}
          name="subject"
          required
          maxLength={MAX_SIGNUP_MAIL_SUBJECT_LENGTH}
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor={`${id}-message`} className="text-sm font-semibold">
          Message
        </label>
        <Textarea
          id={`${id}-message`}
          name="message"
          required
          rows={6}
          maxLength={MAX_SIGNUP_MAIL_MESSAGE_LENGTH}
        />
        <p className="text-muted-foreground text-xs">
          Each person gets an email of their own, with a button to the event
          page under your message. Markdown works: [link text](https://…),
          **bold**, *italic*. Placeholders: {signupMailPlaceholderList()};{" "}
          {"{name}"} is each person&apos;s own name. Replies go to{" "}
          {mail.replyTo}.
          {mail.copyTo ? ` A copy of each email goes to ${mail.copyTo}.` : null}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" size="sm" disabled={busy}>
          {busy ? "Sending…" : "Send email"}
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={onClose}>
          Close
        </Button>
        {error ? (
          <span role="alert" className="text-destructive-light text-sm">
            {error}
          </span>
        ) : null}
        {result ? (
          <span role="status" className="text-sm">
            {result.sent.length > 0
              ? `Sent to ${listNames(result.sent)}.`
              : null}
            {result.failed.length > 0
              ? ` Couldn't email ${listNames(result.failed)}; the error is in the logs.`
              : null}
          </span>
        ) : null}
      </div>
    </fetcher.Form>
  );
}

function listNames(names: readonly string[]): string {
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
}
