// What the mail editors' preview and test button
// (app/features/mail/admin-mail-draft-tools.tsx) and their route
// (app/routes/admin.mail-preview.ts) agree on.

export const MAIL_DRAFT_PATH = "/admin/mail-preview";

/**
 * The mails an admin writes: to everyone still coming, the payment
 * reminder, a message to one group, and an event's signup mail.
 */
export const MAIL_DRAFT_KINDS = [
  "everyone",
  "reminder",
  "message",
  "signup",
] as const;

export type MailDraftKind = (typeof MAIL_DRAFT_KINDS)[number];

export function isMailDraftKind(value: unknown): value is MailDraftKind {
  return (MAIL_DRAFT_KINDS as readonly unknown[]).includes(value);
}

export interface MailDraftRecipient {
  name: string;
  email: string;
}

export type MailDraftReply =
  | {
      ok: true;
      intent: "preview";
      subject: string;
      html: string;
      /** Whose mail the preview shows; null when it's filled with examples. */
      recipient: MailDraftRecipient | null;
      /** How many people it would go to as things stand; null for a signup mail. */
      recipientCount: number | null;
    }
  | { ok: true; intent: "test"; sentTo: string }
  | { ok: false; error: string };
