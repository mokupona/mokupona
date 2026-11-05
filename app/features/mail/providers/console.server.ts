import type { MailMessage, MailProvider } from "../types";

export function createConsoleProvider(): MailProvider {
  const send = async (message: MailMessage) => {
    console.info(
      [
        "📬 mail (console provider)",
        `To:      ${message.to}`,
        ...(message.from ? [`From:    ${message.from}`] : []),
        ...(message.replyTo ? [`Reply-To: ${message.replyTo}`] : []),
        `Subject: ${message.subject}`,
        "",
        message.text,
      ].join("\n"),
    );
  };

  return {
    send,
  };
}
