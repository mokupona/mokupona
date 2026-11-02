import { summarizeBooking } from "./booking-summary";
import type { SignupMailKind } from "./confirmation-mail";

import type { FieldDescriptor } from "~/features/forms/fields";
import { parseStoredFormSchemaOrLog } from "~/features/forms/serialization.server";
import { sendTemplate } from "~/features/mail/mail.server";
import { getSignupForMail } from "~/models/event-signup.server";
import type { Event } from "~/models/event.server";

export const DEFAULT_EVENT_SIGNUP_MAIL_FROM = "moku pona <noreply@mokupona.ch>";

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
  | "studentPrice"
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
 * Tells the person who signed up whether they have a seat or are on the
 * waiting list, and what we stored, guest by guest, with prices.
 */
export async function sendSignupConfirmation({
  to,
  status,
  event,
  formFields,
  answers,
  origin,
}: {
  to: string;
  status: SignupMailKind;
  event: SignupMailEvent;
  formFields: FieldDescriptor[];
  answers: Record<string, unknown>;
  /** This site's origin, for the link back to the event page. */
  origin: string;
}): Promise<void> {
  await sendTemplate(
    "signupConfirmation",
    to,
    {
      status,
      event: {
        title: event.title,
        date: event.date,
        url: new URL(`/events/${event.id}`, origin).href,
        ...mailCopyFor(event, status),
      },
      booking: summarizeBooking(formFields, answers, {
        price: event.price,
        studentPrice: event.studentPrice,
      }),
    },
    { from: eventSignupMailFrom() },
  );
}

/**
 * The "seat confirmed" mail for a signup an admin moved up from the waiting
 * list, rebuilt from the stored answers and the form version they were
 * given against.
 */
export async function sendSeatConfirmedMail({
  submissionId,
  origin,
}: {
  submissionId: string;
  origin: string;
}): Promise<void> {
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

  const to =
    typeof answers.email === "string" && answers.email.trim()
      ? answers.email.trim()
      : signup.email;
  if (!to) throw new Error(`Signup ${submissionId} has no email address`);

  await sendSignupConfirmation({
    to,
    status: "confirmed",
    event,
    formFields,
    answers,
    origin,
  });
}
