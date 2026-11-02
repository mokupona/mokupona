import { Resend } from "resend";

import type { MailMessage, MailProvider } from "../types";

const DEFAULT_FROM = "moku pona <noreply@mokupona.ch>";

export function createResendProvider(
  env: NodeJS.ProcessEnv = process.env,
): MailProvider {
  const apiKey = env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error('RESEND_API_KEY must be set when MAIL_PROVIDER="resend"');
  }

  const resend = new Resend(apiKey);
  const from = env.MAIL_FROM ?? DEFAULT_FROM;

  const send = async (message: MailMessage) => {
    const { error } = await resend.emails.send({
      ...message,
      from: message.from ?? from,
    });
    if (error) {
      throw new Error(`Resend rejected the message: ${error.message}`);
    }
  };

  return {
    send,
  };
}
