import { latestMailPath } from "~/features/mail/capture.shared";

interface CapturedMail {
  to: string;
  from?: string;
  subject: string;
  text: string;
  html?: string;
  sequence: number;
}

export function readLatestMailTo(
  email: string,
): Cypress.Chainable<CapturedMail> {
  return cy.readFile(latestMailPath(email), { timeout: 10_000 });
}

function extractMailLink(mail: CapturedMail, pathPart: string): string {
  const links = mail.text.match(/https?:\/\/[^\s"'<>)]+/g) ?? [];
  const link = links.find((url) => new URL(url).pathname.includes(pathPart));
  if (!link) {
    throw new Error(
      `No link containing "${pathPart}" in mail "${mail.subject}" to ${mail.to}:\n${mail.text}`,
    );
  }
  return link;
}

export function visitMailLink(mail: CapturedMail, pathPart: string) {
  const url = new URL(extractMailLink(mail, pathPart));
  return cy.visit(url.pathname + url.search);
}
