import type { MailBody } from "./compose";
import { createCaptureProvider } from "./providers/capture.server";
import { createConsoleProvider } from "./providers/console.server";
import { createResendProvider } from "./providers/resend.server";
import { mailTemplates } from "./templates";
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

export async function sendTemplate<Name extends MailTemplateName>(
  name: Name,
  to: string,
  props: MailTemplateProps<Name>,
  { from }: { from?: string } = {},
): Promise<void> {
  const render = mailTemplates[name] as (
    props: MailTemplateProps<Name>,
    t: Text,
  ) => MailBody;

  try {
    const body = render(props, await getText());
    await provider.send({ to, ...(from && { from }), ...body });
  } catch (error) {
    requestLogger.error(
      { template: name, email: to, error },
      "Failed to send mail",
    );
    throw error;
  }

  requestLogger.info({ template: name, email: to }, "Sent mail");
}
