import {
  bookingPrices,
  bookingWithout,
  summarizeBooking,
  type BookingSummary,
} from "./booking-summary";
import { getSignupBookingsForEvent } from "./bookings.server";
import type { SignupMailCopy, SignupMailKind } from "./confirmation-mail";
import {
  everyoneMailRecipients,
  type EveryoneMailRecipient,
  type EveryoneMailStatus,
} from "./everyone-mail";
import { isPaymentReminderDue } from "./payment-reminders";
import {
  messageRecipients,
  type MessageRecipient,
  type SignupMailRecordKind,
} from "./signup-mails";

import type { FieldDescriptor } from "~/features/forms/fields";
import { parseStoredFormSchemaOrLog } from "~/features/forms/serialization.server";
import { sendTemplate } from "~/features/mail/mail.server";
import {
  fillSignupMailCopy,
  signupMailValues,
} from "~/features/mail/templates";
import { getText } from "~/features/site-text/site-text.server";
import { requestLogger } from "~/logger/request-context.server";
import { getSignupForMail } from "~/models/event-signup.server";
import { getEventById, type Event } from "~/models/event.server";
import {
  claimPaymentReminder,
  recordSignupMail,
  releasePaymentReminder,
} from "~/models/signup-mail.server";

export const DEFAULT_EVENT_SIGNUP_MAIL_FROM = "moku pona <noreply@mokupona.ch>";

/**
 * Where a guest's reply to a message from the signup sheet lands, rather
 * than at the noreply sender.
 */
export const SIGNUP_MESSAGE_REPLY_TO = "contact@mokupona.ch";

/**
 * Event mail goes out under the society's own address. Account mail (verify,
 * reset, invite) keeps `MAIL_FROM`. The domain must be verified in Resend.
 */
export function eventSignupMailFrom(env: NodeJS.ProcessEnv = process.env) {
  return env.EVENT_SIGNUP_MAIL_FROM?.trim() || DEFAULT_EVENT_SIGNUP_MAIL_FROM;
}

type SignupMailEvent = Pick<
  Event,
  | "id"
  | "title"
  | "date"
  | "price"
  | "studentDiscount"
  | "vegetarianDiscount"
  | "confirmedMailSubject"
  | "confirmedMailMessage"
  | "waitlistMailSubject"
  | "waitlistMailMessage"
>;

function mailCopyFor(event: SignupMailEvent, status: SignupMailKind) {
  return status === "confirmed"
    ? {
        mailSubject: event.confirmedMailSubject,
        mailMessage: event.confirmedMailMessage,
      }
    : {
        mailSubject: event.waitlistMailSubject,
        mailMessage: event.waitlistMailMessage,
      };
}

/**
 * Notes a mail that went out in the signup's record. The mail is out either
 * way, so a record that can't be written is logged, not thrown.
 */
async function recordSentMail(mail: {
  submissionId: string;
  kind: SignupMailRecordKind;
  recipient: string;
  subject?: string;
  message?: string;
  sentById?: string | null;
}): Promise<void> {
  try {
    await recordSignupMail(mail);
  } catch (error) {
    requestLogger.error(
      { submission: mail.submissionId, kind: mail.kind, error },
      "Failed to record a signup mail that went out",
    );
  }
}

/**
 * Tells the person who signed up whether they have a seat or are on the
 * waiting list, and what we stored, guest by guest, with prices. Each mail
 * that goes out is kept on the signup's record. Anyone an admin cancelled on
 * their own is left out of the mail, and gets no note of their own.
 */
export async function sendSignupConfirmation({
  submissionId,
  to,
  status,
  event,
  formFields,
  answers,
  cancelled = [],
  origin,
  sentById = null,
}: {
  submissionId: string;
  to: string;
  status: SignupMailKind;
  event: SignupMailEvent;
  formFields: FieldDescriptor[];
  answers: Record<string, unknown>;
  /** The places in the booking of the people cancelled on their own. */
  cancelled?: readonly number[];
  /** This site's origin, for the link back to the event page. */
  origin: string;
  /** The admin who had it sent; null when it goes out at signup. */
  sentById?: string | null;
}): Promise<void> {
  const t = await getText();
  const url = new URL(`/events/${event.id}`, origin).href;
  const booking = summarizeBooking(
    formFields,
    answers,
    bookingPrices(event),
    t,
  );

  await sendTemplate(
    "signupConfirmation",
    to,
    {
      status,
      event: {
        title: event.title,
        date: event.date,
        url,
        ...mailCopyFor(event, status),
      },
      booking,
      cancelled,
    },
    { from: eventSignupMailFrom() },
  );
  await recordSentMail({ submissionId, kind: status, recipient: to, sentById });

  await sendFriendSignupMails({
    submissionId,
    eventId: event.id,
    status,
    event: { title: event.title, date: event.date, url },
    booking,
    cancelled,
    signerEmail: to,
    sentById,
  });
}

/**
 * Tells each friend the signer gave an address for that they've been signed
 * up. Each address gets one mail, never the signer's own, and a friend who
 * can't be reached doesn't hold up the signup: failures are logged. A friend
 * cancelled on their own gets none.
 */
async function sendFriendSignupMails({
  submissionId,
  eventId,
  status,
  event,
  booking,
  cancelled,
  signerEmail,
  sentById,
}: {
  submissionId: string;
  eventId: string;
  status: SignupMailKind;
  event: { title: string; date: Date; url: string };
  booking: BookingSummary;
  cancelled: readonly number[];
  signerEmail: string;
  sentById: string | null;
}): Promise<void> {
  const [signer, ...friends] = booking.guests;
  const reached = new Set([signerEmail.trim().toLowerCase()]);

  const recipients = friends.flatMap((guest, friendIndex) => {
    // the signer is 0 in the booking, their friends from 1
    if (cancelled.includes(friendIndex + 1)) return [];
    if (!guest.email) return [];
    const key = guest.email.toLowerCase();
    if (reached.has(key)) return [];
    reached.add(key);
    return [{ email: guest.email, guest }];
  });

  const results = await Promise.allSettled(
    recipients.map(({ email, guest }) =>
      sendTemplate(
        "friendSignup",
        email,
        { status, signer: signer.name, event, guest },
        { from: eventSignupMailFrom() },
      ),
    ),
  );

  for (const [index, result] of results.entries()) {
    if (result.status === "rejected") {
      requestLogger.error(
        { event: eventId, error: result.reason },
        "Failed to send a friend's signup mail",
      );
    } else {
      await recordSentMail({
        submissionId,
        kind: "friend",
        recipient: recipients[index].email,
        sentById,
      });
    }
  }
}

/**
 * A stored signup read back for a mail: its event, the form version it was
 * given against, the answers, where the signer's mail goes, and the places
 * in the booking of anyone cancelled on their own.
 */
async function readSignupForMail(submissionId: string) {
  const signup = await getSignupForMail(submissionId);
  const event = signup?.formVersion.form.event;
  if (!signup || !event) {
    throw new Error(`Signup ${submissionId} has no event to write about`);
  }

  const formFields = parseStoredFormSchemaOrLog(signup.formVersion);
  const answers = signup.answers;
  if (
    !formFields ||
    typeof answers !== "object" ||
    answers === null ||
    Array.isArray(answers)
  ) {
    throw new Error(`Signup ${submissionId} can't be read back for its mail`);
  }

  const signerEmail =
    typeof answers.email === "string" && answers.email.trim()
      ? answers.email.trim()
      : signup.email;

  const cancelled = signup.guestBookkeeping.map((guest) => guest.guestIndex);

  return { event, formFields, answers, signerEmail, cancelled };
}

/**
 * The signup mail for a stored signup, rebuilt from its answers: the "seat
 * confirmed" mail when an admin moves a signup up from the waiting list, or
 * whichever one is due when an admin sends it from the signup sheet.
 */
export async function sendStoredSignupMail({
  submissionId,
  status,
  origin,
  sentById,
}: {
  submissionId: string;
  status: SignupMailKind;
  origin: string;
  /** The admin who had it sent. */
  sentById: string;
}): Promise<void> {
  const { event, formFields, answers, signerEmail, cancelled } =
    await readSignupForMail(submissionId);
  if (!signerEmail) {
    throw new Error(`Signup ${submissionId} has no email address`);
  }

  await sendSignupConfirmation({
    submissionId,
    to: signerEmail,
    status,
    event,
    formFields,
    answers,
    cancelled,
    origin,
    sentById,
  });
}

/**
 * A message an admin wrote on the signup sheet, sent to each guest picked
 * (by their place in the booking) as a mail of its own, with the
 * placeholders filled in for them: {guests} and {total} for the group as it
 * stands, without anyone cancelled on their own. Each one that goes out is
 * kept on the signup's record; a guest whose mail fails doesn't stop the
 * others.
 */
export async function sendSignupMessage({
  submissionId,
  guestIndexes,
  subject,
  message,
  origin,
  sentById,
}: {
  submissionId: string;
  guestIndexes: readonly number[];
  subject: string;
  /** Markdown, like an event's own signup message. */
  message: string;
  origin: string;
  /** The admin who wrote it. */
  sentById: string;
}): Promise<{ sent: MessageRecipient[]; failed: MessageRecipient[] }> {
  const { event, formFields, answers, signerEmail, cancelled } =
    await readSignupForMail(submissionId);
  const t = await getText();
  const signedUp = summarizeBooking(
    formFields,
    answers,
    bookingPrices(event),
    t,
  );
  const booking = bookingWithout(signedUp, new Set(cancelled));
  const url = new URL(`/events/${event.id}`, origin).href;

  // someone cancelled on their own can still be written to, when picked
  const recipients = messageRecipients(signedUp.guests, signerEmail).filter(
    (recipient) => guestIndexes.includes(recipient.guestIndex),
  );

  const results = await Promise.allSettled(
    recipients.map(async (recipient) => {
      const filled = fillSignupMailCopy(
        { subject, message },
        signupMailValues({ name: recipient.name, event, booking }, t),
      );
      await sendTemplate(
        "signupMessage",
        recipient.email,
        { ...filled, event: { title: event.title, url } },
        { from: eventSignupMailFrom(), replyTo: SIGNUP_MESSAGE_REPLY_TO },
      );
      await recordSentMail({
        submissionId,
        kind: "custom",
        recipient: recipient.email,
        ...filled,
        sentById,
      });
    }),
  );

  const sent: MessageRecipient[] = [];
  const failed: MessageRecipient[] = [];
  for (const [index, result] of results.entries()) {
    (result.status === "fulfilled" ? sent : failed).push(recipients[index]);
  }

  return { sent, failed };
}

/**
 * The payment reminder, sent from the signup sheet to the groups an admin
 * picked that are due one (payment-reminders.ts): a group picked on a stale
 * page that has paid or been reminded since is left out. It goes to the
 * person who signed the group up, with the
 * placeholders filled in for their group and {total} and {half} at what it
 * pays after anyone set to pay half or nothing.
 *
 * The mails go out one at a time, so a long list stays inside the mail
 * provider's rate limit. Each group is ticked as reminded just before its
 * mail goes out, so a second click can't remind it twice, and unticked again
 * if the mail fails; the mails that go out are kept on the signups' records.
 * Answers with the names of the people reached, and of those who weren't.
 */
export async function sendPaymentReminders({
  eventId,
  submissionIds,
  copy,
  origin,
  sentById,
}: {
  eventId: string;
  /** The groups the admin picked. */
  submissionIds: readonly string[];
  /** Markdown, placeholders still in. */
  copy: SignupMailCopy;
  origin: string;
  /** The admin who sent it. */
  sentById: string;
}): Promise<{ sent: string[]; failed: string[] }> {
  const event = await getEventById(eventId);
  if (!event) throw new Error(`Event ${eventId} doesn't exist`);
  const t = await getText();
  const url = new URL(`/events/${event.id}`, origin).href;
  const picked = new Set(submissionIds);
  const due = (
    await getSignupBookingsForEvent(eventId, bookingPrices(event), t)
  ).filter(
    (signup) => picked.has(signup.submissionId) && isPaymentReminderDue(signup),
  );

  const sent: string[] = [];
  const failed: string[] = [];

  for (const signup of due) {
    const name = signup.booking.guests[0]?.name ?? signup.signerEmail;
    // someone else got there first
    if (!(await claimPaymentReminder(signup.submissionId))) continue;

    // {guests} counts only the people still coming, as amountDue does
    const cancelled = new Set(
      signup.guestBookkeeping.flatMap((guest, guestIndex) =>
        guest.cancelledAt ? [guestIndex] : [],
      ),
    );
    const filled = fillSignupMailCopy(
      copy,
      signupMailValues(
        {
          name,
          event,
          booking: bookingWithout(signup.booking, cancelled),
          total: signup.amountDue,
        },
        t,
      ),
    );

    try {
      await sendTemplate(
        "paymentReminder",
        signup.signerEmail,
        { ...filled, event: { title: event.title, url } },
        { from: eventSignupMailFrom(), replyTo: SIGNUP_MESSAGE_REPLY_TO },
      );
    } catch {
      // sendTemplate has logged why; the group is due again
      failed.push(name);
      await releasePaymentReminder(signup.submissionId).catch((error) =>
        requestLogger.error(
          { submission: signup.submissionId, error },
          "Failed to untick a payment reminder that didn't go out",
        ),
      );
      continue;
    }

    sent.push(name);
    await recordSentMail({
      submissionId: signup.submissionId,
      kind: "reminder",
      recipient: signup.signerEmail,
      ...filled,
      sentById,
    });
  }

  return { sent, failed };
}

/**
 * A message an admin wrote on the signup sheet for everyone still coming,
 * say the last details before the dinner: each person in the groups of the
 * statuses picked that we can write to gets a mail of their own
 * (everyone-mail.ts), with the placeholders filled in for them and their
 * group, {total} and {half} at what it pays after anyone set to pay half or
 * nothing. Nobody cancelled gets one.
 *
 * The mails go out one at a time, so a long list stays inside the mail
 * provider's rate limit, and one that fails doesn't stop the others. Each
 * one that goes out is kept on its signup's record. Answers with the people
 * reached, and those who weren't.
 */
export async function sendMessageToEveryone({
  eventId,
  statuses,
  copy,
  origin,
  sentById,
}: {
  eventId: string;
  statuses: readonly EveryoneMailStatus[];
  /** Markdown, placeholders still in. */
  copy: SignupMailCopy;
  origin: string;
  /** The admin who wrote it. */
  sentById: string;
}): Promise<{
  sent: EveryoneMailRecipient[];
  failed: EveryoneMailRecipient[];
}> {
  const event = await getEventById(eventId);
  if (!event) throw new Error(`Event ${eventId} doesn't exist`);
  const t = await getText();
  const url = new URL(`/events/${event.id}`, origin).href;
  const signups = await getSignupBookingsForEvent(
    eventId,
    bookingPrices(event),
    t,
  );
  const signupsById = new Map(
    signups.map((signup) => [signup.submissionId, signup]),
  );

  const sent: EveryoneMailRecipient[] = [];
  const failed: EveryoneMailRecipient[] = [];

  for (const recipient of everyoneMailRecipients(signups, statuses)) {
    const signup = signupsById.get(recipient.submissionId);
    if (!signup) continue;

    // {guests} counts only the people still coming, as amountDue does
    const cancelled = new Set(
      signup.guestBookkeeping.flatMap((guest, guestIndex) =>
        guest.cancelledAt ? [guestIndex] : [],
      ),
    );
    const filled = fillSignupMailCopy(
      copy,
      signupMailValues(
        {
          name: recipient.name,
          event,
          booking: bookingWithout(signup.booking, cancelled),
          total: signup.amountDue,
        },
        t,
      ),
    );

    try {
      await sendTemplate(
        "signupMessage",
        recipient.email,
        { ...filled, event: { title: event.title, url } },
        { from: eventSignupMailFrom(), replyTo: SIGNUP_MESSAGE_REPLY_TO },
      );
    } catch {
      // sendTemplate has logged why
      failed.push(recipient);
      continue;
    }

    sent.push(recipient);
    await recordSentMail({
      submissionId: recipient.submissionId,
      kind: "custom",
      recipient: recipient.email,
      ...filled,
      sentById,
    });
  }

  return { sent, failed };
}
