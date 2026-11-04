import type { MailBody } from "./compose";
import { action, compose, details, markdown, note, paragraph } from "./compose";

import { formatEventMailDate } from "~/features/events/date-format";
import {
  formatChf,
  type BookingGuest,
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
import { escapeMarkdown } from "~/shared/markdown.server";

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
  // the message is Markdown; what a guest typed (their name) is filled in as
  // plain text, so it can't turn into a link or markup
  const message = fillSignupMailPlaceholders(
    event.mailMessage?.trim() || defaults.message,
    Object.fromEntries(
      Object.entries(values).map(([name, value]) => [
        name,
        escapeMarkdown(value),
      ]),
    ) as SignupMailValues,
  );

  const total =
    booking.guests.length === 1
      ? t("emails.signup.total.one")
      : t("emails.signup.total.other", { count: booking.guests.length });

  return compose(
    subject,
    [
      markdown(message),
      ...booking.guests.map((guest, index) =>
        details(
          t(index === 0 ? "emails.signup.guestSelf" : "emails.signup.guest", {
            number: index + 1,
            name: guest.name,
          }),
          // the signer sees where the friend's note went
          guest.email
            ? [...guest.rows, [t("emails.signup.guestEmail"), guest.email]]
            : guest.rows,
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

export interface FriendSignupProps {
  status: SignupMailKind;
  /** The person who signed the friend up, as they wrote their name. */
  signer: string;
  event: {
    title: string;
    date: Date;
    /** Absolute link to the public event page. */
    url: string;
  };
  /** The friend's own place in the booking: their price and answers. */
  guest: BookingGuest;
}

/**
 * Sent to a friend someone put down on a signup with an email address. It
 * says what the signer did and what the friend owes, not the whole party.
 */
function friendSignup(
  { status, signer, event, guest }: FriendSignupProps,
  t: Text,
) {
  const waitlisted = status === "waitlisted";
  const vars = {
    signer,
    event: event.title,
    date: formatEventMailDate(event.date),
  };
  const subject = t(
    waitlisted
      ? "emails.friend.waitlistedSubject"
      : "emails.friend.confirmedSubject",
    vars,
  )
    .replace(/\s+/g, " ")
    .trim();

  return compose(
    subject,
    [
      paragraph(t("emails.friend.greeting", { name: guest.name })),
      paragraph(
        t(
          waitlisted
            ? "emails.friend.waitlistedBody"
            : "emails.friend.confirmedBody",
          vars,
        ),
      ),
      paragraph(t("emails.friend.price", { price: formatChf(guest.price, t) })),
      ...(guest.rows.length > 0
        ? [details(t("emails.signup.details"), guest.rows)]
        : []),
      action(t("emails.signup.button"), event.url),
      note(t("emails.friend.note")),
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

  friendSignup,
} satisfies Record<string, (props: never, t: Text) => MailBody>;

type MailTemplates = typeof mailTemplates;
export type MailTemplateName = keyof MailTemplates;
export type MailTemplateProps<K extends MailTemplateName> = Parameters<
  MailTemplates[K]
>[0];
