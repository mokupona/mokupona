import type { MailBody } from "./compose";
import { action, compose, details, note, paragraph } from "./compose";

import { formatEventMailDate } from "~/features/events/date-format";
import {
  formatChf,
  type BookingSummary,
} from "~/features/signup-form/booking-summary";
import {
  defaultSignupMailCopy,
  fillSignupMailPlaceholders,
  type SignupMailKind,
  type SignupMailValues,
} from "~/features/signup-form/confirmation-mail";
import type { Text } from "~/features/site-text/text";
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

function options(t: Text) {
  return { linkFallback: t("emails.linkFallback") };
}

function signupConfirmation(
  { status, event, booking }: SignupConfirmationProps,
  t: Text,
) {
  const defaults = defaultSignupMailCopy(t)[status];
  const [signer] = booking.guests;
  const values: SignupMailValues = {
    name: signer.name,
    event: event.title,
    date: formatEventMailDate(event.date),
    guests: String(booking.guests.length),
    total: formatChf(booking.total, t),
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

  const total =
    booking.guests.length === 1
      ? t("emails.signup.total.one")
      : t("emails.signup.total.other", { count: booking.guests.length });

  return compose(
    subject,
    [
      ...message
        .split(/\n\s*\n/)
        .map((text) => text.trim())
        .filter(Boolean)
        .map(paragraph),
      ...booking.guests.map((guest, index) =>
        details(
          t(index === 0 ? "emails.signup.guestSelf" : "emails.signup.guest", {
            number: index + 1,
            name: guest.name,
          }),
          guest.rows,
        ),
      ),
      ...(booking.contact.length > 0
        ? [details(t("emails.signup.details"), booking.contact)]
        : []),
      details(
        status === "waitlisted"
          ? t("emails.signup.priceWaitlisted")
          : t("emails.signup.price"),
        [
          ...booking.guests.map(
            (guest) =>
              [
                guest.isStudent
                  ? t("emails.signup.student", { name: guest.name })
                  : guest.name,
                formatChf(guest.price, t),
              ] as const,
          ),
          [total, formatChf(booking.total, t)],
        ],
      ),
      action(t("emails.signup.button"), event.url),
      note(t("emails.signup.note")),
    ],
    options(t),
  );
}

/**
 * Every mail the site sends. Each takes its props and the site texts, so an
 * admin's edits under Emails reach the inbox.
 */
export const mailTemplates = {
  verifyEmail: ({ url }: { url: string }, t: Text) =>
    compose(
      t("emails.verify.subject"),
      [
        paragraph(t("emails.verify.welcome")),
        paragraph(t("emails.verify.body")),
        action(t("emails.verify.button"), url),
        note(t("emails.verify.note")),
      ],
      options(t),
    ),

  resetPassword: ({ url }: { url: string }, t: Text) =>
    compose(
      t("emails.reset.subject"),
      [
        paragraph(t("emails.reset.intro")),
        paragraph(t("emails.reset.body")),
        action(t("emails.reset.button"), url),
        note(t("emails.reset.note")),
      ],
      options(t),
    ),

  invite: (
    { url, roleName }: { url: string; roleName: InvitableRole },
    t: Text,
  ) =>
    compose(
      t("emails.invite.subject"),
      [
        paragraph(
          roleName === "moderator"
            ? t("emails.invite.introModerator")
            : t("emails.invite.introUser"),
        ),
        paragraph(t("emails.invite.body")),
        action(t("emails.invite.button"), url),
        note(t("emails.invite.note")),
      ],
      options(t),
    ),

  signupConfirmation,
} satisfies Record<string, (props: never, t: Text) => MailBody>;

type MailTemplates = typeof mailTemplates;
export type MailTemplateName = keyof MailTemplates;
export type MailTemplateProps<K extends MailTemplateName> = Parameters<
  MailTemplates[K]
>[0];
