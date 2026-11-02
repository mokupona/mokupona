import type { MailBody } from "./compose";
import { action, compose, details, note, paragraph } from "./compose";

import { formatEventMailDate } from "~/features/events/date-format";
import {
  formatChf,
  type BookingSummary,
} from "~/features/signup-form/booking-summary";
import {
  DEFAULT_SIGNUP_MAIL_COPY,
  fillSignupMailPlaceholders,
  type SignupMailKind,
  type SignupMailValues,
} from "~/features/signup-form/confirmation-mail";
import type { InvitableRole } from "~/features/users/invite.shared";

export interface SignupConfirmationProps {
  /** Whether the signup holds a seat or a waiting-list spot. */
  status: SignupMailKind;
  event: {
    title: string;
    date: Date;
    /** Absolute link to the public event page. */
    url: string;
    /**
     * The admin's copy for this event and status; null or blank uses the
     * default copy for the status.
     */
    mailSubject: string | null;
    mailMessage: string | null;
  };
  booking: BookingSummary;
}

function signupConfirmation({
  status,
  event,
  booking,
}: SignupConfirmationProps) {
  const defaults = DEFAULT_SIGNUP_MAIL_COPY[status];
  const [signer] = booking.guests;
  const values: SignupMailValues = {
    name: signer.name,
    event: event.title,
    date: formatEventMailDate(event.date),
    guests: String(booking.guests.length),
    total: formatChf(booking.total),
  };

  const subject = fillSignupMailPlaceholders(
    event.mailSubject?.trim() || defaults.subject,
    values,
  )
    // a subject is one header line, whatever was typed
    .replace(/\s+/g, " ")
    .trim();
  const message = fillSignupMailPlaceholders(
    event.mailMessage?.trim() || defaults.message,
    values,
  )
    // browsers submit textarea line breaks as CRLF
    .replace(/\r\n?/g, "\n");

  const guestCount =
    booking.guests.length === 1
      ? "1 person"
      : `${booking.guests.length} people`;

  return compose(subject, [
    ...message
      .split(/\n\s*\n/)
      .map((text) => text.trim())
      .filter(Boolean)
      .map(paragraph),
    ...booking.guests.map((guest, index) =>
      details(
        `Guest ${index + 1}: ${guest.name}${index === 0 ? " (you)" : ""}`,
        guest.rows,
      ),
    ),
    ...(booking.contact.length > 0
      ? [details("Your details", booking.contact)]
      : []),
    details(status === "waitlisted" ? "Price once you have a seat" : "Price", [
      ...booking.guests.map(
        (guest) =>
          [
            guest.isStudent ? `${guest.name} (student)` : guest.name,
            formatChf(guest.price),
          ] as const,
      ),
      [`Total for ${guestCount}`, formatChf(booking.total)],
    ]),
    action("View the event", event.url),
    note("If you didn't sign up for this event, you can ignore this email."),
  ]);
}

export const mailTemplates = {
  verifyEmail: ({ url }: { url: string }) =>
    compose("Verify your email address", [
      paragraph("Welcome to moku pona!"),
      paragraph("Confirm your email address to activate your account:"),
      action("Verify email address", url),
      note("If you didn't create an account, you can ignore this email."),
    ]),

  resetPassword: ({ url }: { url: string }) =>
    compose("Reset your password", [
      paragraph(
        "Someone requested a password reset for your moku pona account.",
      ),
      paragraph("Set a new password here (the link expires in one hour):"),
      action("Reset password", url),
      note(
        "If this wasn't you, you can ignore this email — your password stays unchanged.",
      ),
    ]),

  invite: ({ url, roleName }: { url: string; roleName: InvitableRole }) =>
    compose("You're invited to moku pona", [
      paragraph(
        roleName === "moderator"
          ? "You've been invited to join moku pona as a moderator and help run our events."
          : "You've been invited to join moku pona.",
      ),
      paragraph(
        "Accept your invite here (the link is tied to this email address and expires in 7 days):",
      ),
      action("Accept invite", url),
      note("If you weren't expecting this, you can ignore this email."),
    ]),

  signupConfirmation,
} satisfies Record<string, (props: never) => MailBody>;

type MailTemplates = typeof mailTemplates;
export type MailTemplateName = keyof MailTemplates;
export type MailTemplateProps<K extends MailTemplateName> = Parameters<
  MailTemplates[K]
>[0];
