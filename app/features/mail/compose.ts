import type { MailMessage } from "./types";

import { markdownToText, renderMarkdown } from "~/shared/markdown.server";

export type DetailRow = readonly [label: string, value: string];

type Block =
  | { kind: "paragraph"; text: string }
  | { kind: "markdown"; html: string; text: string }
  | { kind: "action"; label: string; url: string }
  | { kind: "note"; text: string }
  | { kind: "details"; title: string; rows: DetailRow[] };

export function paragraph(text: string): Block {
  return { kind: "paragraph", text };
}

/**
 * An admin's Markdown, e.g. a signup message: html in the html part, and in
 * the text part the words with each link's address after its label.
 */
export function markdown(source: string): Block {
  return {
    kind: "markdown",
    html: renderMarkdown(source),
    text: markdownToText(source, { linkUrls: true }),
  };
}

export function action(label: string, url: string): Block {
  return { kind: "action", label, url };
}

export function note(text: string): Block {
  return { kind: "note", text };
}

/** A titled list of label/value rows, e.g. one guest of a booking. */
export function details(title: string, rows: DetailRow[]): Block {
  return { kind: "details", title, rows };
}

export type MailBody = Omit<MailMessage, "to">;

export interface ComposeOptions {
  /** Shown under each button in html, above the bare link. */
  linkFallback: string;
}

export function compose(
  subject: string,
  blocks: Block[],
  options: ComposeOptions,
): MailBody {
  for (const block of blocks) {
    if (block.kind === "action") assertWebUrl(block.url);
  }

  return {
    subject,
    text: renderText(blocks),
    html: renderHtml(subject, blocks, options),
  };
}

function renderText(blocks: Block[]): string {
  const lines = blocks.map((block) => {
    switch (block.kind) {
      case "action":
        return block.url;
      case "details":
        return [
          block.title,
          ...block.rows.map(([label, value]) => `${label}: ${value}`),
        ].join("\n");
      default:
        return block.text;
    }
  });
  return lines.join("\n\n");
}

/**
 * The same mail under a notice of its own, e.g. the team's copy of what a
 * guest got: the notice opens both parts, the original follows untouched.
 */
export function withNotice(
  body: MailBody,
  { subject, notice }: { subject: string; notice: string },
): MailBody {
  const banner = `<p style="${NOTICE_STYLE}">${escapeMultiline(notice)}</p>`;
  const html =
    body.html && /<body[^>]*>/.test(body.html)
      ? body.html.replace(/<body[^>]*>/, (tag) => `${tag}\n    ${banner}`)
      : `${banner}\n${body.html ?? ""}`;

  return {
    ...body,
    subject,
    text: [notice, NOTICE_RULE, body.text].join("\n\n"),
    html,
  };
}

const NOTICE_RULE = "-".repeat(40);
const NOTICE_STYLE =
  "margin: 0 0 24px; padding: 12px 16px; border-left: 4px solid #999; background: #f4f4f4; font-family: sans-serif;";
const NOTE_STYLE = "color: #666; font-size: 13px;";
const DETAIL_CELL_STYLE = "padding: 2px 0; vertical-align: top;";
const DETAIL_LABEL_STYLE = `${DETAIL_CELL_STYLE} padding-right: 16px; color: #666;`;

function renderHtml(
  subject: string,
  blocks: Block[],
  options: ComposeOptions,
): string {
  const opening = blocks.find(
    (block) => block.kind === "paragraph" || block.kind === "markdown",
  );
  // the inbox preview: the mail's first paragraph
  const preheader = opening?.text.split("\n\n")[0] ?? subject;
  const body = blocks
    .map((block) => renderBlock(block, options))
    .join("\n      ");

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(subject)}</title>
  </head>
  <body style="margin: 0; padding: 24px;">
    <span style="display: none; max-height: 0; overflow: hidden;">${escapeHtml(preheader)}</span>
    <div style="font-family: sans-serif; line-height: 1.5; max-width: 32rem;">
      ${body}
    </div>
  </body>
</html>`;
}

function renderBlock(block: Block, { linkFallback }: ComposeOptions): string {
  switch (block.kind) {
    case "paragraph":
      return `<p>${escapeMultiline(block.text)}</p>`;
    case "markdown":
      // renderMarkdown escapes the source itself
      return block.html;
    case "note":
      return `<p style="${NOTE_STYLE}">${escapeMultiline(block.text)}</p>`;
    case "details":
      return renderDetails(block.title, block.rows);
    case "action":
      return [
        `<p><a href="${escapeHtml(block.url)}">${escapeHtml(block.label)}</a></p>`,
        `<p style="${NOTE_STYLE}">${escapeHtml(linkFallback)}<br>${escapeHtml(block.url)}</p>`,
      ].join("\n      ");
  }
}

function renderDetails(title: string, rows: DetailRow[]): string {
  const heading = `<p style="margin-bottom: 4px;"><strong>${escapeHtml(title)}</strong></p>`;
  if (rows.length === 0) return heading;

  const body = rows
    .map(
      ([label, value]) =>
        `<tr><td style="${DETAIL_LABEL_STYLE}">${escapeHtml(label)}</td><td style="${DETAIL_CELL_STYLE}">${escapeMultiline(value)}</td></tr>`,
    )
    .join("");

  return [
    heading,
    `<table role="presentation" style="border-collapse: collapse; margin: 0 0 16px;">${body}</table>`,
  ].join("\n      ");
}

// line breaks typed into a message survive in html, where they'd otherwise
// collapse into spaces
function escapeMultiline(value: string): string {
  return escapeHtml(value).replace(/\r?\n/g, "<br>");
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function assertWebUrl(url: string): void {
  let protocol: string;
  try {
    protocol = new URL(url).protocol;
  } catch {
    throw new Error(`Mail action link must be an absolute URL, got "${url}"`);
  }
  if (protocol !== "http:" && protocol !== "https:") {
    throw new Error(`Mail action link must be http(s), got "${url}"`);
  }
}
