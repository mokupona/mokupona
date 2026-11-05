// What the signup sheet knows about the mails a signup got (the SignupMail
// rows in prisma/schema.prisma): whether its confirmation is out, and who an
// admin can write to. Shared by the sheet, its action and the mail code.

import type { SignupMailKind } from "./confirmation-mail";
import type { SignupStatus } from "./signup-status";

const SIGNUP_MAIL_RECORD_KINDS = [
  "confirmed",
  "waitlisted",
  "friend",
  "custom",
] as const;

/**
 * "confirmed" and "waitlisted": the signup mail to the signer, with that
 * outcome. "friend": the note to a friend the signer gave an address for.
 * "custom": a message an admin wrote on the signup sheet.
 */
export type SignupMailRecordKind = (typeof SIGNUP_MAIL_RECORD_KINDS)[number];

function isSignupMailRecordKind(value: string): value is SignupMailRecordKind {
  return (SIGNUP_MAIL_RECORD_KINDS as readonly string[]).includes(value);
}

function isSignupMailKind(kind: SignupMailRecordKind): kind is SignupMailKind {
  return kind === "confirmed" || kind === "waitlisted";
}

export interface SentSignupMail {
  kind: SignupMailRecordKind;
  recipient: string;
  /** An admin's subject and message; empty for the site's own mails. */
  subject: string;
  message: string;
  sentAt: Date;
  /** The admin who sent it; null when it went out on its own at signup. */
  sentBy: string | null;
}

/** A stored row as the sheet reads it; a kind this code doesn't know is left out. */
export function toSentSignupMail(row: {
  kind: string;
  recipient: string;
  subject: string;
  message: string;
  createdAt: Date;
  sentBy: { name: string } | null;
}): SentSignupMail[] {
  if (!isSignupMailRecordKind(row.kind)) return [];
  return [
    {
      kind: row.kind,
      recipient: row.recipient,
      subject: row.subject,
      message: row.message,
      sentAt: row.createdAt,
      sentBy: row.sentBy?.name ?? null,
    },
  ];
}

export type ConfirmationMailState =
  /** The signup mail for the signup's current status went out. */
  | { kind: "sent"; mail: SignupMailKind; sentAt: Date }
  /**
   * The signup mail for the current status isn't on record, so the sheet
   * offers to send it.
   */
  | {
      kind: "due";
      mail: SignupMailKind;
      /** The last signup mail that did go out, written for another status. */
      previous: { mail: SignupMailKind; sentAt: Date } | null;
      /**
       * False for a signup from before the site kept track: it may have got
       * its mail all the same.
       */
      tracked: boolean;
    }
  /** A cancelled signup: no mail is due. */
  | { kind: "none"; last: { mail: SignupMailKind; sentAt: Date } | null };

/**
 * Whether a signup has had the mail its status calls for: the seat
 * confirmation for a confirmed signup, the waiting-list mail for one on the
 * waiting list. A confirmed signup that only ever got the waiting-list mail
 * (say, its "seat confirmed" mail failed) still has its confirmation due.
 */
export function confirmationMailState({
  status,
  mailsTracked,
  mails,
}: {
  status: SignupStatus;
  mailsTracked: boolean;
  mails: readonly SentSignupMail[];
}): ConfirmationMailState {
  const last = mails.reduce<{ mail: SignupMailKind; sentAt: Date } | null>(
    (latest, mail) =>
      isSignupMailKind(mail.kind) &&
      (!latest || mail.sentAt.getTime() >= latest.sentAt.getTime())
        ? { mail: mail.kind, sentAt: mail.sentAt }
        : latest,
    null,
  );

  if (status === "cancelled") return { kind: "none", last };
  if (last?.mail === status) {
    return { kind: "sent", mail: status, sentAt: last.sentAt };
  }
  return { kind: "due", mail: status, previous: last, tracked: mailsTracked };
}

export interface MessageRecipient {
  /** The guest's place in the booking: 0 is the signer, then their friends. */
  guestIndex: number;
  name: string;
  email: string;
}

/**
 * The people in a signup an admin can write to: the signer, and each friend
 * the signer gave an address for. An address shared by two guests is listed
 * once, under the first of them.
 */
export function messageRecipients(
  guests: readonly { name: string; email: string | null }[],
  signerEmail: string,
): MessageRecipient[] {
  const seen = new Set<string>();

  return guests.flatMap((guest, guestIndex) => {
    const email = (guestIndex === 0 ? signerEmail : (guest.email ?? "")).trim();
    if (!email) return [];
    const key = email.toLowerCase();
    if (seen.has(key)) return [];
    seen.add(key);
    return [{ guestIndex, name: guest.name, email }];
  });
}
