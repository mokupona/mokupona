import type { MailBody } from "./compose";
import {
  action,
  compose,
  details,
  markdown,
  note,
  paragraph,
  withNotice,
} from "./compose";

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

/**
 * What the placeholders of a signup's mail stand for. `name` is whoever the
 * mail is for: the signer, unless an admin writes to one of their friends.
 */
export function signupMailValues(
  {
    name,
    event,
    booking,
  }: {
    name: string;
    event: { title: string; date: Date };
    booking: BookingSummary;
  },
  t: Text,
): SignupMailValues {
  return {
    name,
    event: event.title,
    date: formatEventMailDate(event.date),
    guests: String(booking.guests.length),
    total: formatChf(booking.total, t),
  };
}

/**
 * An admin's subject and Markdown message with the placeholders filled in.
 * What a guest typed (their name) goes into the message as plain text, so it
 * can't turn into a link or markup.
 */
export function fillSignupMailCopy(
  copy: { subject: string; message: string },
  values: SignupMailValues,
): { subject: string; message: string } {
  return {
    subject: fillSignupMailPlaceholders(copy.subject, values)
      // a subject is one header line, whatever was typed
      .replace(/\s+/g, " ")
      .trim(),
    message: fillSignupMailPlaceholders(
      copy.message,
      Object.fromEntries(
        Object.entries(values).map(([name, value]) => [
          name,
          escapeMarkdown(value),
        ]),
      ) as SignupMailValues,
    ),
  };
}

function signupConfirmation(
  { status, event, booking }: SignupConfirmationProps,
  t: Text,
) {
  const defaults = defaultSignupMailCopy(t)[status];
  const [signer] = booking.guests;
  const { subject, message } = fillSignupMailCopy(
    {
      subject: event.mailSubject?.trim() || defaults.subject,
      message: event.mailMessage?.trim() || defaults.message,
    },
    signupMailValues({ name: signer.name, event, booking }, t),
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

export interface SignupMessageProps {
  /** The admin's subject, placeholders already filled in for this guest. */
  subject: string;
  /** The admin's Markdown message, placeholders already filled in. */
  message: string;
  event: {
    title: string;
    /** Absolute link to the public event page. */
    url: string;
  };
}

/** A message an admin wrote to a guest on the event's signup sheet. */
function signupMessage(
  { subject, message, event }: SignupMessageProps,
  t: Text,
) {
  return compose(
    subject,
    [
      markdown(message),
      action(t("emails.message.button"), event.url),
      note(t("emails.message.note", { event: event.title })),
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

  signupMessage,

  volunteerInterest: (
    { name, email, message }: { name: string; email: string; message?: string },
    t: Text,
  ) =>
    compose(
      t("emails.volunteer.subject", { name }).replace(/\s+/g, " ").trim(),
      [
        paragraph(t("emails.volunteer.body", { name, email })),
        ...(message ? [paragraph(message)] : []),
        note(t("emails.volunteer.note")),
      ],
      options(t),
    ),
} satisfies Record<string, (props: never, t: Text) => MailBody>;

type MailTemplates = typeof mailTemplates;
export type MailTemplateName = keyof MailTemplates;
export type MailTemplateProps<K extends MailTemplateName> = Parameters<
  MailTemplates[K]
>[0];

/**
 * The mails that go to guests. The team inbox gets a copy of each one that
 * goes out (mail.server.ts); account mails and mail to the team don't.
 */
export const GUEST_MAIL_TEMPLATES: ReadonlySet<MailTemplateName> = new Set([
  "signupConfirmation",
  "friendSignup",
  "signupMessage",
]);

/**
 * The team's copy of a guest's mail: the mail itself, under a line saying
 * who got it.
 */
export function teamCopy(
  body: MailBody,
  { to }: { to: string },
  t: Text,
): MailBody {
  return withNotice(body, {
    subject: t("emails.copy.subject", { email: to, subject: body.subject })
      .replace(/\s+/g, " ")
      .trim(),
    notice: t("emails.copy.intro", { email: to }),
  });
}
