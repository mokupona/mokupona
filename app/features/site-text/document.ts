// The markup long pages (privacy policy, impressum) are written in, so an
// admin can add, reorder and remove whole sections, not just reword them:
//
//   ## Section heading
//   ### Sub-heading
//   1. numbered list item
//   - bulleted list item
//   [link text](https://example.com)   (also /a-page and mailto:…)
//   **bold**
//
// A blank line starts a new paragraph; a single line break stays a line
// break. Nothing here is ever rendered as HTML, so whatever is typed stays
// text.

export type DocumentInline =
  | { kind: "text"; text: string }
  | { kind: "break" }
  | { kind: "bold"; children: DocumentInline[] }
  | { kind: "link"; href: string; children: DocumentInline[] };

export type DocumentBlock =
  | { kind: "paragraph"; content: DocumentInline[] }
  | { kind: "list"; ordered: boolean; items: DocumentInline[][] };

export interface DocumentSubsection {
  title: string;
  blocks: DocumentBlock[];
}

export interface DocumentSection {
  /** null for anything written before the first `##` heading */
  title: string | null;
  blocks: DocumentBlock[];
  subsections: DocumentSubsection[];
}

const ORDERED_ITEM = /^\d+[.)]\s+/;
const BULLET_ITEM = /^[-*]\s+/;
const LINK_OR_BOLD = /\[([^\]\n]+)\]\(([^)\s]+)\)|\*\*([^*\n]+)\*\*/g;

/** Links an admin may type: other pages here, the web, mail and phone. */
export function isSafeHref(href: string): boolean {
  if (href.startsWith("/") && !href.startsWith("//")) return true;
  if (href.startsWith("#")) return true;
  return /^(https?:\/\/|mailto:|tel:)/i.test(href);
}

export function parseInline(text: string): DocumentInline[] {
  const result: DocumentInline[] = [];

  const pushText = (value: string) => {
    const lines = value.split("\n");
    lines.forEach((line, index) => {
      if (index > 0) result.push({ kind: "break" });
      if (!line) return;
      const previous = result[result.length - 1];
      if (previous?.kind === "text") previous.text += line;
      else result.push({ kind: "text", text: line });
    });
  };

  let last = 0;
  for (const match of text.matchAll(LINK_OR_BOLD)) {
    const index = match.index ?? 0;
    pushText(text.slice(last, index));
    const [raw, linkText, href, bold] = match;
    if (bold !== undefined) {
      result.push({ kind: "bold", children: parseInline(bold) });
    } else if (isSafeHref(href)) {
      result.push({ kind: "link", href, children: parseInline(linkText) });
    } else {
      pushText(raw);
    }
    last = index + raw.length;
  }
  pushText(text.slice(last));

  return result;
}

function parseBlocks(lines: string[]): DocumentBlock[] {
  const blocks: DocumentBlock[] = [];
  let paragraph: string[] = [];

  const flushParagraph = () => {
    if (paragraph.length > 0) {
      blocks.push({
        kind: "paragraph",
        content: parseInline(paragraph.join("\n")),
      });
      paragraph = [];
    }
  };

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed) {
      flushParagraph();
      continue;
    }

    const ordered = ORDERED_ITEM.test(trimmed);
    const bullet = !ordered && BULLET_ITEM.test(trimmed);
    if (ordered || bullet) {
      flushParagraph();
      const text = trimmed.replace(ordered ? ORDERED_ITEM : BULLET_ITEM, "");
      const previous = blocks[blocks.length - 1];
      if (previous?.kind === "list" && previous.ordered === ordered) {
        previous.items.push(parseInline(text));
      } else {
        blocks.push({ kind: "list", ordered, items: [parseInline(text)] });
      }
      continue;
    }

    paragraph.push(trimmed);
  }
  flushParagraph();

  return blocks;
}

/**
 * Splits a document into `##` sections and their `###` subsections; the
 * lines in between become paragraphs and lists.
 */
export function parseDocument(source: string): DocumentSection[] {
  const sections: DocumentSection[] = [];
  let section: DocumentSection | null = null;
  let subsection: DocumentSubsection | null = null;
  let lines: string[] = [];

  const flush = () => {
    const blocks = parseBlocks(lines);
    lines = [];
    if (subsection) {
      subsection.blocks.push(...blocks);
      return;
    }
    if (blocks.length === 0) return;
    if (!section) {
      section = { title: null, blocks: [], subsections: [] };
      sections.push(section);
    }
    section.blocks.push(...blocks);
  };

  for (const line of source.replace(/\r\n?/g, "\n").split("\n")) {
    const heading = /^(#{2,3})\s+(.+)$/.exec(line.trim());
    if (!heading) {
      lines.push(line);
      continue;
    }

    flush();
    const [, level, title] = heading;
    if (level === "##") {
      section = { title: title.trim(), blocks: [], subsections: [] };
      sections.push(section);
      subsection = null;
    } else {
      if (!section) {
        section = { title: null, blocks: [], subsections: [] };
        sections.push(section);
      }
      subsection = { title: title.trim(), blocks: [] };
      section.subsections.push(subsection);
    }
  }
  flush();

  return sections;
}
