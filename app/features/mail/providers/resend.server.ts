import { Resend } from "resend";

import type { MailMessage, MailProvider } from "../types";

const DEFAULT_FROM = "moku pona <noreply@mokupona.ch>";

/**
 * Resend takes only a few requests a second. A burst of mail (the payment
 * reminder to every group, each with the team's copy) waits and tries again
 * this many times before a mail counts as failed.
 */
const RATE_LIMIT_RETRIES = 3;

export function createResendProvider(
  env: NodeJS.ProcessEnv = process.env,
  {
    retryDelayMs = 1000,
  }: {
    /** The wait before the first retry; each one after waits longer. */
    retryDelayMs?: number;
  } = {},
): MailProvider {
  const apiKey = env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error('RESEND_API_KEY must be set when MAIL_PROVIDER="resend"');
  }

  const resend = new Resend(apiKey);
  const from = env.MAIL_FROM ?? DEFAULT_FROM;

  const send = async (message: MailMessage) => {
    for (let attempt = 0; ; attempt++) {
      const { error } = await resend.emails.send({
        ...message,
        from: message.from ?? from,
      });
      if (!error) return;

      if (
        error.name === "rate_limit_exceeded" &&
        attempt < RATE_LIMIT_RETRIES
      ) {
        await new Promise((resolve) =>
          setTimeout(resolve, retryDelayMs * (attempt + 1)),
        );
        continue;
      }
      throw new Error(`Resend rejected the message: ${error.message}`);
    }
  };

  return {
    send,
  };
}
