// The signup confirmation mail's per-event copy. Shared by the mail template,
// which fills it in, and the admin event form, which shows the defaults and
// validates what an admin types.

import type { Text } from "~/features/site-text/text";

export type SignupMailKind = "confirmed" | "waitlisted";

export interface SignupMailCopy {
  subject: string;
  message: string;
}

/**
 * The copy an event without its own uses: the site-wide texts under Emails.
 * "confirmed" goes out when a signup gets a seat straight away and when an
 * admin later moves it up from the waiting list, so it reads right for both.
 */
export function defaultSignupMailCopy(
  t: Text,
): Record<SignupMailKind, SignupMailCopy> {
  return {
    confirmed: {
      subject: t("emails.signup.confirmedSubject"),
      message: t("emails.signup.confirmedMessage"),
    },
    waitlisted: {
      subject: t("emails.signup.waitlistedSubject"),
      message: t("emails.signup.waitlistedMessage"),
    },
  };
}

export const SIGNUP_MAIL_PLACEHOLDERS = {
  name: "name of the person who signed up",
  event: "event title",
  date: "date and time of the event",
  guests: "number of people in the signup",
  total: "total price of the signup",
} as const;

export type SignupMailPlaceholder = keyof typeof SIGNUP_MAIL_PLACEHOLDERS;
export type SignupMailValues = Record<SignupMailPlaceholder, string>;

export const MAX_SIGNUP_MAIL_SUBJECT_LENGTH = 200;
export const MAX_SIGNUP_MAIL_MESSAGE_LENGTH = 5000;

const PLACEHOLDER_PATTERN = /\{(\w+)\}/g;

function isPlaceholder(name: string): name is SignupMailPlaceholder {
  return Object.prototype.hasOwnProperty.call(SIGNUP_MAIL_PLACEHOLDERS, name);
}

export function fillSignupMailPlaceholders(
  template: string,
  values: SignupMailValues,
): string {
  return template.replace(PLACEHOLDER_PATTERN, (match, name: string) =>
    isPlaceholder(name) ? values[name] : match,
  );
}

/** Placeholders in `template` the mail wouldn't fill, e.g. a typo'd `{nmae}`. */
export function unknownSignupMailPlaceholders(template: string): string[] {
  const unknown = new Set<string>();
  for (const [match, name] of template.matchAll(PLACEHOLDER_PATTERN)) {
    if (!isPlaceholder(name)) unknown.add(match);
  }
  return [...unknown];
}

export function signupMailPlaceholderList(): string {
  return Object.keys(SIGNUP_MAIL_PLACEHOLDERS)
    .map((name) => `{${name}}`)
    .join(", ");
}
