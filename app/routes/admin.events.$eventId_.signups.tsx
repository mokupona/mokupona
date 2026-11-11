import { CheckIcon, DownloadIcon } from "lucide-react";
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
  MAX_SIGNUP_MAIL_MESSAGE_LENGTH,
  MAX_SIGNUP_MAIL_SUBJECT_LENGTH,
  signupMailPlaceholderList,
  unknownSignupMailPlaceholders,
  type SignupMailKind,
} from "~/features/signup-form/confirmation-mail";
import {
  sendSignupMessage,
  sendStoredSignupMail,
  SIGNUP_MESSAGE_REPLY_TO,
} from "~/features/signup-form/confirmation-mail.server";
import {
  summarizeHeadcount,
  type HeadcountSummary,
} from "~/features/signup-form/headcount";
import {
  halfPrice,
  isPaymentMethod,
  MAX_DONATION_RAPPEN,
  MAX_TWINT_FEE_FIXED_RAPPEN,
  MAX_TWINT_FEE_PERCENT,
  parseChfInput,
  parsePercentInput,
  PAYMENT_METHOD_LABELS,
  PAYMENT_METHODS,
  rappenToInput,
  summarizeMoneyReceived,
  type MoneyReceived,
  type PaymentMethod,
  type PaymentParty,
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
  SignupNotFoundError,
  updateSignupBookkeeping,
  updateSignupGuest,
  updateSignupStatus,
} from "~/models/event-signup.server";
import { getEventById, setEventTwintFees } from "~/models/event.server";
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
  size: number;
  /** What the whole party pays, in CHF. */
  total: number;
  createdAt: Date;
  /** The signer first, then their friends, each with their price and answers. */
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
  const { guests, contact, total } = signup.booking;

  return {
    submissionId: signup.submissionId,
    status: signup.status,
    isLegacy: signup.isLegacy,
    name: guests[0]?.name ?? "",
    email: signup.signerEmail,
    size: guests.length,
    total,
    createdAt: signup.createdAt,
    guests,
    contact,
    singlePayment: signup.singlePayment,
    firstHalfPaid: signup.firstHalfPaid,
    secondHalfPaid: signup.secondHalfPaid,
    firstHalfMethod: signup.firstHalfMethod,
    secondHalfMethod: signup.secondHalfMethod,
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

/** A party as the money received reads it: its ticked payments and donations. */
function toPaymentParty(party: Party): PaymentParty {
  return {
    status: party.status,
    total: party.total,
    singlePayment: party.singlePayment,
    firstHalf: { paid: party.firstHalfPaid, method: party.firstHalfMethod },
    secondHalf: { paid: party.secondHalfPaid, method: party.secondHalfMethod },
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

  return {
    event: {
      title: event.title,
      slots: event.slots,
    },
    seats: { ...seats, left: seatsLeft(event.slots, seats.confirmed) },
    parties,
    revenue: summarizeRevenue(
      parties.map((party) => ({
        status: party.status,
        people: party.size,
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
        })),
      })),
    ),
    mail: { copyTo: guestMailCopyTo(), replyTo: SIGNUP_MESSAGE_REPLY_TO },
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
): Parameters<typeof updateSignupBookkeeping>[0]["data"] {
  switch (intent) {
    case "payments": {
      // a half the form leaves out (the second, while the party pays in one
      // payment) stays as it was, ready for when it pays in halves again;
      // the form sends each half's method with its tick, so a method
      // that's missing is a half that wasn't there
      const firstHalfMethod = readMethod(formData, "firstHalfMethod");
      const secondHalfMethod = readMethod(formData, "secondHalfMethod");
      return {
        singlePayment: formData.has("singlePayment"),
        ...(firstHalfMethod && {
          firstHalfPaid: formData.has("firstHalfPaid"),
          firstHalfMethod,
        }),
        ...(secondHalfMethod && {
          secondHalfPaid: formData.has("secondHalfPaid"),
          secondHalfMethod,
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
  const index = Number(formData.get("guest"));
  if (!Number.isInteger(index) || index < 0) {
    throw new Response("Bad Request", { status: 400 });
  }
  return index;
}

/** A person's arrival or donation, checked before anything is stored. */
function readGuestUpdate(
  intent: "arrival" | "donation",
  formData: FormData,
): Parameters<typeof updateSignupGuest>[0]["data"] | { error: string } {
  if (intent === "arrival") {
    return { arrivedAt: formData.has("arrived") ? new Date() : null };
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

  // a person's arrival and donation, ticked and noted during the dinner
  if (intent === "arrival" || intent === "donation") {
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
  const field = (name: string) => {
    const value = formData.get(name);
    return typeof value === "string" ? value.trim() : "";
  };
  const subject = field("subject");
  const message = field("message");
  const guestIndexes = formData
    .getAll("recipient")
    .map(Number)
    .filter((index) => Number.isInteger(index) && index >= 0);

  if (guestIndexes.length === 0) {
    return { error: "Pick at least one person to write to." };
  }
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

  return { subject, message, guestIndexes };
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
  const { event, seats, parties, revenue, money, twintFees, headcount, mail } =
    loaderData;
  const waitingGroups = parties.filter(
    (party) => party.status === "waitlisted",
  ).length;
  const mailsDue = parties.filter(
    (party) => party.confirmation.kind === "due",
  ).length;
  const overbookedBy = seats.confirmed - event.slots;
  const arrived = headcount.confirmed.arrived + headcount.waitlisted.arrived;

  return (
    <main className="animate-page-in">
      <BackLink to="/admin/events" prefetch="intent">
        Events
      </BackLink>

      <AdminPageHeader
        eyebrow={[
          `${seats.confirmed} / ${event.slots} seats confirmed`,
          ...(seats.waitlisted > 0 ? [`${seats.waitlisted} waiting`] : []),
          ...(arrived > 0 ? [`${arrived} arrived`] : []),
        ].join(" · ")}
        title={event.title}
        actions={
          <a
            href="signups.csv"
            className={buttonVariants({ variant: "outline" })}
          >
            <DownloadIcon className="size-4" />
            Export CSV
          </a>
        }
      />

      <RevenueSummary revenue={revenue} money={money} />

      <div className="mb-8 grid gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <MoneyReceivedSummary money={money} fees={twintFees} />
        <Headcount headcount={headcount} />
      </div>

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

      <div className="flex flex-col gap-6">
        {SECTIONS.map(({ status, title, empty }) => {
          const rows = parties.filter((party) => party.status === status);
          if (status === "cancelled" && rows.length === 0) return null;
          const total = rows.reduce((sum, party) => sum + party.total, 0);
          const people = rows.reduce((sum, party) => sum + party.size, 0);

          return (
            <section key={status} aria-labelledby={`signups-${status}`}>
              <h2
                id={`signups-${status}`}
                className="mb-3 text-lg font-semibold"
              >
                {title}{" "}
                <span className="text-muted-foreground text-sm font-normal">
                  {rows.length} {rows.length === 1 ? "group" : "groups"}
                  {` · ${peopleCount(people)}`}
                  {status === "cancelled" ? null : ` · ${formatCHF(total)}`}
                </span>
              </h2>
              <PartyTable
                parties={rows}
                seatsLeft={seats.left}
                emptyText={empty}
                mail={mail}
              />
            </section>
          );
        })}
      </div>
    </main>
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
          note={`From ${peopleCount(revenue.confirmedPeople)} with a confirmed seat`}
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
              : `What ${peopleCount(revenue.waitlistPeople)} would pay if every group got a seat`
          }
        />
        <Stat
          label="Per person"
          value={
            revenue.averagePerPerson === null
              ? "—"
              : formatCHF(revenue.averagePerPerson)
          }
          note="Average over confirmed seats, students at the student price"
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

function Headcount({ headcount }: { headcount: HeadcountSummary }) {
  const { confirmed, waitlisted } = headcount;

  const rows = [
    {
      label: "People",
      confirmed: confirmed.people,
      waitlisted: waitlisted.people,
      strong: true,
    },
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
      </Card>
    </section>
  );
}

function peopleCount(count: number) {
  return `${count} ${count === 1 ? "person" : "people"}`;
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

function PartyTable({
  parties,
  seatsLeft,
  emptyText,
  mail,
}: {
  parties: Party[];
  seatsLeft: number;
  emptyText: string;
  mail: MailSettings;
}) {
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
}: {
  party: Party;
  seatsLeft: number;
  mail: MailSettings;
}) {
  const [open, setOpen] = useState(false);
  const detailsId = `party-${party.submissionId}`;
  const rowSpan = party.guests.length;
  // the party's last row closes it off, unless its details follow
  const closingRow = open ? -1 : rowSpan - 1;

  return (
    <>
      {party.guests.map((guest, guestIndex) => (
        <GuestRow
          key={guestIndex}
          party={party}
          guest={guest}
          guestIndex={guestIndex}
          closesParty={guestIndex === closingRow}
          signerExtras={
            guestIndex === 0 ? (
              <>
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
          {guestIndex === 0 ? (
            <PartyCells party={party} rowSpan={rowSpan} seatsLeft={seatsLeft} />
          ) : null}
        </GuestRow>
      ))}
      {open ? (
        <TableRow className="hover:bg-transparent">
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

/** One person's cells: their arrival, name, price and donation. */
function GuestRow({
  party,
  guest,
  guestIndex,
  closesParty,
  signerExtras,
  children,
}: {
  party: Party;
  guest: BookingGuest;
  guestIndex: number;
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
  const own = cn(CELL, arrived && "bg-primary/10");
  const tags = [
    guest.vegetarian === true ? "vegetarian" : null,
    guest.isStudent ? "student" : null,
  ].filter(Boolean);

  return (
    <TableRow
      className={cn(
        "hover:bg-transparent",
        !closesParty && "border-foreground/10 border-dashed",
      )}
    >
      <TableCell className={cn(own, "text-center")}>
        {party.isLegacy ? (
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
          {party.isLegacy ? (
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
          {signerExtras}
        </div>
      </TableCell>
      <TableCell className={cn(own, "text-right")}>
        <PriceLines price={guest.price} />
      </TableCell>
      <TableCell className={own}>
        {party.isLegacy ? (
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
 * A price in whole francs, and the half that each payment comes to, unless
 * it's paid in one payment.
 */
function PriceLines({
  price,
  singlePayment = false,
}: {
  price: number;
  singlePayment?: boolean;
}) {
  return (
    <div className="flex flex-col items-end whitespace-nowrap tabular-nums">
      <span className="font-semibold">{formatCHF(price)}</span>
      <span className="text-muted-foreground text-xs">
        {singlePayment
          ? "in 1 payment"
          : `half ${formatRappen(halfPrice(price))}`}
      </span>
    </div>
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
  return (
    <>
      <TableCell rowSpan={rowSpan} className={cn(CELL, "border-l text-center")}>
        {party.size}
      </TableCell>
      <TableCell rowSpan={rowSpan} className={cn(CELL, "text-right")}>
        <PriceLines price={party.total} singlePayment={party.singlePayment} />
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
          <GuestCard key={guestIndex} guest={guest} signer={guestIndex === 0} />
        ))}
      </div>
    </div>
  );
}

function GuestCard({
  guest,
  signer,
}: {
  guest: BookingGuest;
  signer: boolean;
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
        </p>
        <p className="text-sm font-semibold whitespace-nowrap tabular-nums">
          {formatCHF(guest.price)}
          {guest.isStudent ? (
            <span className="text-muted-foreground font-normal">
              {" "}
              · student
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
  const fetcher = useFetcher();

  if (party.isLegacy) {
    return <span className="text-muted-foreground text-sm">—</span>;
  }

  // shows the switch at once, before the page has reloaded its data
  const singlePayment = fetcher.formData
    ? fetcher.formData.has("singlePayment")
    : party.singlePayment;

  // the ticks are native checkboxes: a click shows at once, and each one is
  // remounted from the saved value once the page has reloaded its data. In
  // one payment, the first half's tick and method stand for the whole price.
  return (
    <fetcher.Form
      method="post"
      className="flex flex-col items-start gap-1 text-sm"
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
          />
          <PaymentTick
            name="secondHalfPaid"
            label="2nd half paid"
            checked={party.secondHalfPaid}
            methodName="secondHalfMethod"
            method={party.secondHalfMethod}
            methodLabel={`How ${party.name}'s group paid the 2nd half`}
          />
        </>
      )}
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

function PaymentTick({
  name,
  label,
  checked,
  methodName,
  method,
  methodLabel,
}: {
  name: string;
  label: string;
  checked: boolean;
  methodName: string;
  method: PaymentMethod;
  methodLabel: string;
}) {
  return (
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
  const overBy = party.size - seatsLeft;

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
              `Confirming ${party.name}'s group of ${party.size} overbooks the event by ${overBy} ${overBy === 1 ? "seat" : "seats"}. Confirm anyway?`,
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
      {party.status === "cancelled" ? null : <ReminderTick party={party} />}
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

  return (
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
              {sent.kind === "custom" ? (
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
