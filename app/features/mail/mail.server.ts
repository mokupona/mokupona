import type { MailBody } from "./compose";
import { createCaptureProvider } from "./providers/capture.server";
import { createConsoleProvider } from "./providers/console.server";
import { createResendProvider } from "./providers/resend.server";
import { GUEST_MAIL_TEMPLATES, mailTemplates, teamCopy } from "./templates";
import type { MailTemplateName, MailTemplateProps } from "./templates";
import type { MailProvider } from "./types";

import { getText } from "~/features/site-text/site-text.server";
import type { Text } from "~/features/site-text/text";
import { requestLogger } from "~/logger/request-context.server";
import { logger } from "~/logger.server";
import { singleton } from "~/utils/singleton.server";

function mailProviderName(env: NodeJS.ProcessEnv) {
  return env.MAIL_PROVIDER ?? "console";
}

export function createMailProvider(
  env: NodeJS.ProcessEnv = process.env,
): MailProvider {
  const name = mailProviderName(env);
  switch (name) {
    case "console":
      return createConsoleProvider();
    case "capture":
      return createCaptureProvider(env.MAIL_CAPTURE_DIR);
    case "resend":
      return createResendProvider(env);
    default:
      throw new Error(
        `Unknown MAIL_PROVIDER "${name}" — expected "resend", "console" or "capture"`,
      );
  }
}

const provider = singleton("mail-provider", () => {
  const instance = createMailProvider();
  logger.info(
    { provider: mailProviderName(process.env) },
    "mail provider selected",
  );
  return instance;
});

export const DEFAULT_GUEST_MAIL_COPY_TO = "mokuponadinnerclub@gmail.com";

/**
 * Where the team gets a copy of every mail to a guest. `GUEST_MAIL_COPY_TO`
 * changes the address; set to an empty string, it turns the copies off.
 */
export function guestMailCopyTo(
  env: NodeJS.ProcessEnv = process.env,
): string | null {
  const configured = env.GUEST_MAIL_COPY_TO;
  if (configured === undefined) return DEFAULT_GUEST_MAIL_COPY_TO;
  return configured.trim() || null;
}

export async function sendTemplate<Name extends MailTemplateName>(
  name: Name,
  to: string,
  props: MailTemplateProps<Name>,
  { from, replyTo }: { from?: string; replyTo?: string } = {},
): Promise<void> {
  const render = mailTemplates[name] as (
    props: MailTemplateProps<Name>,
    t: Text,
  ) => MailBody;

  let body: MailBody;
  let t: Text;
  try {
    t = await getText();
    body = render(props, t);
    await provider.send({
      to,
      ...(from && { from }),
      ...(replyTo && { replyTo }),
      ...body,
    });
  } catch (error) {
    requestLogger.error(
      { template: name, email: to, error },
      "Failed to send mail",
    );
    throw error;
  }

  requestLogger.info({ template: name, email: to }, "Sent mail");

  if (GUEST_MAIL_TEMPLATES.has(name)) {
    await sendTeamCopy({ template: name, to, from, body, t });
  }
}

/**
 * Sends the team inbox what a guest just got. The guest's mail is out
 * either way, so a copy that fails is logged, not thrown.
 */
async function sendTeamCopy({
  template,
  to,
  from,
  body,
  t,
}: {
  template: MailTemplateName;
  to: string;
  from?: string;
  body: MailBody;
  t: Text;
}): Promise<void> {
  const copyTo = guestMailCopyTo();
  if (!copyTo || copyTo.toLowerCase() === to.trim().toLowerCase()) return;

  try {
    await provider.send({
      to: copyTo,
      ...(from && { from }),
      ...teamCopy(body, { to }, t),
    });
  } catch (error) {
    requestLogger.error(
      { template, email: to, error },
      "Failed to send the team's copy of a guest mail",
    );
    return;
  }

  requestLogger.info({ template, email: to }, "Sent the team a copy");
}
