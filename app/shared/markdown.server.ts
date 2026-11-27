import MarkdownIt from "markdown-it";

// Event texts (description, menu, donation, discounts) and signup mail
// messages take a small slice of Markdown: [links](https://…), **bold**,
// *italic*, ~~strikethrough~~, lists and line breaks. Bare URLs and email
// addresses still turn into links on their own, as they did before.
//
// Everything else stays plain text: raw HTML is escaped, and headings, code,
// quotes, rules, tables and images are left out on purpose. These texts were
// written as plain text for years, and those rules would restyle them by
// surprise (an indented line becoming a code block, a "---" line a rule).
//
// Mail messages alone also take images, ![description](https://…), which is
// what pasting a picture into one of their editors inserts. A page keeps
// leaving them out.
const SCHEME = /^([a-z][a-z0-9+.-]*):/i;
const ALLOWED_SCHEMES = new Set(["http", "https", "mailto"]);
// a mail is read far from the site, so its images need a full address
const ABSOLUTE_IMAGE_URL = /^https?:\/\//i;
// a picture as wide as the mail at most, never wider than it is
const MAIL_IMAGE_STYLE = "max-width: 100%; height: auto; border: 0;";

function createMarkdown({ images }: { images: boolean }) {
  const md = new MarkdownIt("zero", {
    // a single line break shows as one, the way the plain text did
    breaks: true,
    linkify: true,
  });
  md.enable([
    "autolink",
    "emphasis",
    "entity",
    "escape",
    "link",
    "linkify",
    "list",
    "newline",
    "strikethrough",
    ...(images ? ["image"] : []),
  ]);
  // "mokupona.ch" without a scheme is a link too
  md.linkify.set({ fuzzyLink: true });

  // No javascript:, data: and the like. A link without a scheme is either a
  // path on this site ("/events") or a domain someone typed without https://.
  md.validateLink = (url) => {
    const scheme = SCHEME.exec(url)?.[1]?.toLowerCase();
    return scheme === undefined || ALLOWED_SCHEMES.has(scheme);
  };

  md.core.ruler.after("linkify", "resolve_hrefs", (state) => {
    for (const block of state.tokens) {
      const children = block.children ?? [];
      children.forEach((token, index) => {
        if (token.type !== "link_open") return;
        const linkifiedText =
          token.markup === "linkify" ? children[index + 1]?.content : undefined;
        token.attrSet(
          "href",
          resolveHref(String(token.attrGet("href") ?? ""), linkifiedText),
        );
      });
    }
  });

  md.renderer.rules.link_open = (tokens, index, options, _env, self) => {
    const token = tokens[index];
    // links out of the site open in a new tab, as the auto-links always did
    if (/^https?:/i.test(String(token.attrGet("href") ?? ""))) {
      token.attrSet("target", "_blank");
      token.attrSet("rel", "noopener noreferrer");
    }
    return self.renderToken(tokens, index, options);
  };

  // Styled inline, the only styling a mail keeps. An image without a full
  // address (one still uploading when the mail went, a path on the site)
  // would show broken in the inbox, so it is left out.
  md.renderer.rules.image = (tokens, index, options, env, self) => {
    const token = tokens[index];
    const src = imageSource(token);
    if (src === null) return "";
    const alt = self.renderInlineAsText(token.children ?? [], options, env);
    const { escapeHtml } = md.utils;
    return `<img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}" style="${MAIL_IMAGE_STYLE}">`;
  };

  return md;
}

function resolveHref(href: string, linkifiedText: string | undefined): string {
  // linkify writes a bare "mokupona.ch" as http://; the site's links are https
  if (linkifiedText !== undefined && !SCHEME.test(linkifiedText)) {
    return href.replace(/^http:\/\//i, "https://");
  }
  if (SCHEME.test(href) || href.startsWith("/") || href.startsWith("#")) {
    return href;
  }
  return `https://${href}`;
}

const md = createMarkdown({ images: false });
const mailMd = createMarkdown({ images: true });

type Token = ReturnType<typeof md.parseInline>[number];

/** An image's address, or null when a mail can't show it. */
function imageSource(token: Token): string | null {
  const src = String(token.attrGet("src") ?? "");
  return ABSOLUTE_IMAGE_URL.test(src) ? src : null;
}

/** The source as html, safe to put on a page or in a mail as it is. */
export function renderMarkdown(source: string): string {
  return md.render(source).trim();
}

/**
 * `renderMarkdown` for a mail message, which can also hold images: each one
 * is an `<img>` styled to fit the mail.
 */
export function renderMailMarkdown(source: string): string {
  return (
    mailMd
      .render(source)
      // a paragraph that held nothing but an image left out
      .replace(/<p><\/p>\n?/g, "")
      .trim()
  );
}

/** `renderMarkdown` for an optional text: null when there's nothing to show. */
export function renderOptionalMarkdown(
  source: string | null | undefined,
): string | null {
  return source?.trim() ? renderMarkdown(source) : null;
}

/**
 * The source as plain text: the words without the markup, for places that
 * show a text as a teaser, and for the text part of a mail. With `linkUrls`,
 * a link reads "label (https://…)" so the address survives; without it only
 * the label is left. With `images`, the source is read as a mail message:
 * an image reads as its description, and with `linkUrls` its address too.
 */
export function markdownToText(
  source: string,
  {
    linkUrls = false,
    images = false,
  }: { linkUrls?: boolean; images?: boolean } = {},
): string {
  const lists: Array<{ ordered: boolean; count: number }> = [];
  let text = "";

  for (const token of (images ? mailMd : md).parse(source, {})) {
    switch (token.type) {
      case "bullet_list_open":
      case "ordered_list_open":
        lists.push({
          ordered: token.type === "ordered_list_open",
          count: Number(token.attrGet("start") ?? 1) - 1,
        });
        break;
      case "bullet_list_close":
      case "ordered_list_close":
        lists.pop();
        if (lists.length === 0) text += "\n";
        break;
      case "list_item_open": {
        const list = lists[lists.length - 1];
        list.count += 1;
        text += "  ".repeat(lists.length - 1);
        text += list.ordered ? `${list.count}. ` : "- ";
        break;
      }
      case "paragraph_close":
        // paragraphs in a tight list are hidden: one line per item
        text += token.hidden ? "\n" : "\n\n";
        break;
      case "inline":
        text += inlineText(token.children ?? [], linkUrls);
        break;
    }
  }

  return text.replace(/\n{3,}/g, "\n\n").trim();
}

function inlineText(tokens: Token[], linkUrls: boolean): string {
  let text = "";
  const links: Array<{ href: string; start: number }> = [];

  for (const token of tokens) {
    switch (token.type) {
      case "text":
      case "text_special":
        text += token.content;
        break;
      case "softbreak":
      case "hardbreak":
        text += "\n";
        break;
      case "link_open":
        links.push({
          href: String(token.attrGet("href") ?? ""),
          start: text.length,
        });
        break;
      case "image": {
        const src = imageSource(token);
        if (src === null) break;
        const alt = inlineText(token.children ?? [], false).trim();
        text += linkUrls ? (alt ? `${alt} (${src})` : src) : alt;
        break;
      }
      case "link_close": {
        const link = links.pop();
        if (!link || !linkUrls) break;
        const label = text.slice(link.start);
        // an auto-linked address already reads as itself
        const bare = link.href.replace(/^(mailto:|https?:\/\/)/i, "");
        if (label !== link.href && label !== bare) text += ` (${link.href})`;
        break;
      }
    }
  }

  return text;
}

/**
 * `value` with every character Markdown could read as markup escaped, for
 * text someone else typed (a guest's name) that goes into a Markdown message.
 */
export function escapeMarkdown(value: string): string {
  return value.replace(/[\\`*_{}[\]()#+\-.!|~<>:&]/g, "\\$&");
}
