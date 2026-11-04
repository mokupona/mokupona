export interface MailMessage {
  to: string;
  /** Overrides the provider's default sender (`MAIL_FROM`) for this message. */
  from?: string;
  subject: string;
  text: string;
  html?: string;
}

export interface MailProvider {
  send(message: MailMessage): Promise<void>;
}
