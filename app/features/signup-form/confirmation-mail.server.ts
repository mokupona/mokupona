import { summarizeBooking } from "./booking-summary";

import type { FieldDescriptor } from "~/features/forms/fields";
import { sendTemplate } from "~/features/mail/mail.server";
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
  | "signupMailSubject"
  | "signupMailMessage"
>;

/** Tells the person who signed up what we stored, guest by guest, with prices. */
export async function sendSignupConfirmation({
  to,
  event,
  formFields,
  answers,
  origin,
}: {
  to: string;
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
      event: {
        title: event.title,
        date: event.date,
        url: new URL(`/events/${event.id}`, origin).href,
        mailSubject: event.signupMailSubject,
        mailMessage: event.signupMailMessage,
      },
      booking: summarizeBooking(formFields, answers, {
        price: event.price,
        studentPrice: event.studentPrice,
      }),
    },
    { from: eventSignupMailFrom() },
  );
}
