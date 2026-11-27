// A mail an admin is still writing, rendered exactly as it would go out:
// the same template, with the placeholders filled in for the first person it
// would reach. The editors show it as a preview and send it to the admin
// alone as a test. When nobody would get it yet (no signups, nobody picked),
// it's filled in for the admin instead, with one guest at the event's price.

import {
  bookingPrices,
  bookingWithout,
  summarizeBooking,
} from "./booking-summary";
import type { BookingSummary } from "./booking-summary";
import { getSignupBookingsForEvent } from "./bookings.server";
import type { SignupMailCopy, SignupMailKind } from "./confirmation-mail";
import {
  eventSignupMailFrom,
  groupMailValues,
  readSignupForMail,
  SIGNUP_MESSAGE_REPLY_TO,
} from "./confirmation-mail.server";
import {
  everyoneMailRecipients,
  type EveryoneMailStatus,
} from "./everyone-mail";
import type { MailDraftRecipient } from "./mail-drafts.shared";
import { isPaymentReminderDue } from "./payment-reminders";
import { messageRecipients } from "./signup-mails";

import type { MailBody } from "~/features/mail/compose";
import {
  fillSignupMailCopy,
  mailTemplates,
  signupMailValues,
} from "~/features/mail/templates";
import { getText } from "~/features/site-text/site-text.server";
import type { Text } from "~/features/site-text/text";
import { getEventById } from "~/models/event.server";
import { getSignupMailState } from "~/models/signup-mail.server";

export type MailDraft =
  | {
      kind: "everyone";
      eventId: string;
      statuses: readonly EveryoneMailStatus[];
      copy: SignupMailCopy;
    }
  | {
      kind: "reminder";
      eventId: string;
      /** The groups picked; none counts every group due one. */
      submissionIds: readonly string[];
      copy: SignupMailCopy;
    }
  | {
      kind: "message";
      eventId: string;
      submissionId: string;
      /** The people picked, by their place in the booking. */
      guestIndexes: readonly number[];
      copy: SignupMailCopy;
    }
  | {
      kind: "signup";
      /** Null for an event that isn't saved yet. */
      eventId: string | null;
      /** What the form says for an event that isn't saved yet. */
      newEvent?: { title: string; price: number };
      status: SignupMailKind;
      /** Blank fields stand for the default text, as on the event. */
      copy: SignupMailCopy;
    };

export interface RenderedDraft {
  body: MailBody;
  from: string;
  replyTo?: string;
  /** Whose mail it is; null when it's filled in with example values. */
  recipient: MailDraftRecipient | null;
  /** How many people it would go to as things stand; null for a signup mail. */
  recipientCount: number | null;
}

/** The admin who's writing: the example guest, and where a test goes. */
export interface DraftWriter {
  name: string;
  email: string;
}

export class DraftNotFoundError extends Error {}

async function requireEvent(eventId: string) {
  const event = await getEventById(eventId);
  if (!event) throw new DraftNotFoundError(`Event ${eventId} doesn't exist`);
  return event;
}

function eventUrl(eventId: string | null, origin: string) {
  return new URL(eventId ? `/events/${eventId}` : "/events", origin).href;
}

/** The writer as the only guest, at the event's price. */
function exampleBooking(writer: DraftWriter, price: number): BookingSummary {
  return {
    guests: [
      {
        name: writer.name,
        isStudent: false,
        vegetarian: null,
        price,
        email: null,
        restrictions: null,
        rows: [],
      },
    ],
    contact: [],
    total: price,
  };
}

function exampleValues(
  writer: DraftWriter,
  event: { title: string; date: Date; price: number },
  t: Text,
) {
  return signupMailValues(
    { name: writer.name, event, booking: exampleBooking(writer, event.price) },
    t,
  );
}

export async function renderMailDraft(
  draft: MailDraft,
  { origin, writer }: { origin: string; writer: DraftWriter },
): Promise<RenderedDraft> {
  const t = await getText();

  switch (draft.kind) {
    case "everyone": {
      const event = await requireEvent(draft.eventId);
      const signups = await getSignupBookingsForEvent(
        event.id,
        bookingPrices(event),
        t,
      );
      const recipients = everyoneMailRecipients(signups, draft.statuses);
      const first = recipients[0];
      const signup =
        first &&
        signups.find((each) => each.submissionId === first.submissionId);
      const filled = fillSignupMailCopy(
        draft.copy,
        first && signup
          ? groupMailValues({ name: first.name, event, signup }, t)
          : exampleValues(writer, event, t),
      );

      return {
        body: mailTemplates.signupMessage(
          {
            ...filled,
            event: { title: event.title, url: eventUrl(event.id, origin) },
          },
          t,
        ),
        from: eventSignupMailFrom(),
        replyTo: SIGNUP_MESSAGE_REPLY_TO,
        recipient: first ? { name: first.name, email: first.email } : null,
        recipientCount: recipients.length,
      };
    }

    case "reminder": {
      const event = await requireEvent(draft.eventId);
      const picked = new Set(draft.submissionIds);
      const due = (
        await getSignupBookingsForEvent(event.id, bookingPrices(event), t)
      ).filter(
        (signup) =>
          isPaymentReminderDue(signup) &&
          (picked.size === 0 || picked.has(signup.submissionId)),
      );
      const first = due[0];
      // as sendPaymentReminders names them
      const name = first
        ? (first.booking.guests[0]?.name ?? first.signerEmail)
        : writer.name;
      const filled = fillSignupMailCopy(
        draft.copy,
        first
          ? groupMailValues({ name, event, signup: first }, t)
          : exampleValues(writer, event, t),
      );

      return {
        body: mailTemplates.paymentReminder(
          {
            ...filled,
            event: { title: event.title, url: eventUrl(event.id, origin) },
          },
          t,
        ),
        from: eventSignupMailFrom(),
        replyTo: SIGNUP_MESSAGE_REPLY_TO,
        recipient: first ? { name, email: first.signerEmail } : null,
        recipientCount: due.length,
      };
    }

    case "message": {
      const state = await getSignupMailState({
        eventId: draft.eventId,
        submissionId: draft.submissionId,
      });
      if (!state) {
        throw new DraftNotFoundError(
          `Signup ${draft.submissionId} isn't one of event ${draft.eventId}'s`,
        );
      }
      const { event, formFields, answers, signerEmail, cancelled } =
        await readSignupForMail(draft.submissionId);
      const signedUp = summarizeBooking(
        formFields,
        answers,
        bookingPrices(event),
        t,
      );
      // as sendSignupMessage fills them
      const booking = bookingWithout(signedUp, new Set(cancelled));
      const picked = messageRecipients(signedUp.guests, signerEmail).filter(
        (recipient) => draft.guestIndexes.includes(recipient.guestIndex),
      );
      const first = picked[0];
      const filled = fillSignupMailCopy(
        draft.copy,
        signupMailValues(
          { name: first?.name ?? writer.name, event, booking },
          t,
        ),
      );

      return {
        body: mailTemplates.signupMessage(
          {
            ...filled,
            event: { title: event.title, url: eventUrl(event.id, origin) },
          },
          t,
        ),
        from: eventSignupMailFrom(),
        replyTo: SIGNUP_MESSAGE_REPLY_TO,
        recipient: first ? { name: first.name, email: first.email } : null,
        recipientCount: picked.length,
      };
    }

    case "signup": {
      const event = draft.eventId
        ? await requireEvent(draft.eventId)
        : {
            id: null,
            title: draft.newEvent?.title ?? "",
            // a week from now, for the date in the mail
            date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            price: draft.newEvent?.price ?? 0,
            studentDiscount: null,
            vegetarianDiscount: null,
          };
      // a signup that got this mail, else any signup, else the writer's own
      const signups = event.id
        ? (
            await getSignupBookingsForEvent(event.id, bookingPrices(event), t)
          ).filter((signup) => !signup.isLegacy)
        : [];
      const signup =
        signups.find((each) => each.status === draft.status) ?? signups[0];

      return {
        body: mailTemplates.signupConfirmation(
          {
            status: draft.status,
            event: {
              title: event.title,
              date: event.date,
              url: eventUrl(event.id, origin),
              mailSubject: draft.copy.subject,
              mailMessage: draft.copy.message,
            },
            booking: signup?.booking ?? exampleBooking(writer, event.price),
            cancelled: signup
              ? signup.guestBookkeeping.flatMap((guest, guestIndex) =>
                  guest.cancelledAt ? [guestIndex] : [],
                )
              : [],
          },
          t,
        ),
        from: eventSignupMailFrom(),
        recipient: signup
          ? {
              name: signup.booking.guests[0]?.name ?? signup.signerEmail,
              email: signup.signerEmail,
            }
          : null,
        recipientCount: null,
      };
    }
  }
}
