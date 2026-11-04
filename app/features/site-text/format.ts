// The small template language every site text is written in, shared by the
// pages that render texts, the mails that send them and the admin editor that
// checks what an admin typed:
//
//   {name}          a value the page fills in (an email address, a count, …)
//   <tag>…</tag>    a stretch the page wraps, e.g. in a link
//
// Anything else is literal text. A stray or unbalanced tag renders as the
// characters it was typed with, so a broken edit shows up on the page instead
// of swallowing the rest of the sentence.

export type TextToken =
  | { kind: "text"; text: string }
  | { kind: "var"; name: string }
  | { kind: "tag"; name: string; children: TextToken[] };

const TOKEN_PATTERN = /\{(\w+)\}|<(\w+)>|<\/(\w+)>/g;
const VAR_PATTERN = /\{(\w+)\}/g;

type RawToken =
  | { kind: "text"; text: string }
  | { kind: "var"; name: string }
  | { kind: "open"; name: string; raw: string }
  | { kind: "close"; name: string; raw: string };

function lex(template: string): RawToken[] {
  const tokens: RawToken[] = [];
  let last = 0;

  for (const match of template.matchAll(TOKEN_PATTERN)) {
    const index = match.index ?? 0;
    if (index > last) {
      tokens.push({ kind: "text", text: template.slice(last, index) });
    }
    const [raw, varName, openName, closeName] = match;
    if (varName !== undefined) tokens.push({ kind: "var", name: varName });
    else if (openName !== undefined)
      tokens.push({ kind: "open", name: openName, raw });
    else tokens.push({ kind: "close", name: closeName!, raw });
    last = index + raw.length;
  }

  if (last < template.length) {
    tokens.push({ kind: "text", text: template.slice(last) });
  }
  return tokens;
}

/** Index of the close tag that matches the open tag at `start`, or -1. */
function findClose(tokens: RawToken[], start: number, name: string): number {
  let depth = 0;
  for (let index = start + 1; index < tokens.length; index++) {
    const token = tokens[index];
    if (token.kind === "open" && token.name === name) depth++;
    if (token.kind === "close" && token.name === name) {
      if (depth === 0) return index;
      depth--;
    }
  }
  return -1;
}

function build(tokens: RawToken[]): TextToken[] {
  const result: TextToken[] = [];

  const pushText = (text: string) => {
    const previous = result[result.length - 1];
    if (previous?.kind === "text") previous.text += text;
    else result.push({ kind: "text", text });
  };

  for (let index = 0; index < tokens.length; index++) {
    const token = tokens[index];
    switch (token.kind) {
      case "text":
        pushText(token.text);
        break;
      case "var":
        result.push(token);
        break;
      case "close":
        pushText(token.raw);
        break;
      case "open": {
        const close = findClose(tokens, index, token.name);
        if (close === -1) {
          pushText(token.raw);
          break;
        }
        result.push({
          kind: "tag",
          name: token.name,
          children: build(tokens.slice(index + 1, close)),
        });
        index = close;
        break;
      }
    }
  }

  return result;
}

export function parseTemplate(template: string): TextToken[] {
  return build(lex(template));
}

export type TextVars = Record<string, string | number>;

/**
 * Fills `{name}` placeholders from `vars`. Placeholders without a value stay
 * as typed, which is what lets a page fill some of them with markup later.
 */
export function fillTemplate(template: string, vars?: TextVars): string {
  if (!vars) return template;
  return template.replace(VAR_PATTERN, (match, name: string) =>
    Object.prototype.hasOwnProperty.call(vars, name)
      ? String(vars[name])
      : match,
  );
}

export interface TemplateProblems {
  /** `{name}` placeholders the text's page doesn't fill. */
  unknownVars: string[];
  /** `<tag>` names the text's page doesn't know. */
  unknownTags: string[];
  /** tags opened without being closed, or closed without being opened */
  unbalancedTags: string[];
}

/** What's wrong with a template, measured against what its page supports. */
export function checkTemplate(
  template: string,
  { vars = [], tags = [] }: { vars?: string[]; tags?: string[] },
): TemplateProblems {
  const unknownVars = new Set<string>();
  const unknownTags = new Set<string>();
  const unbalancedTags = new Set<string>();
  const open: string[] = [];

  for (const token of lex(template)) {
    if (token.kind === "var" && !vars.includes(token.name)) {
      unknownVars.add(`{${token.name}}`);
    }
    if (token.kind === "open" || token.kind === "close") {
      if (!tags.includes(token.name)) {
        unknownTags.add(`<${token.name}>`);
        continue;
      }
      if (token.kind === "open") open.push(token.name);
      else if (open[open.length - 1] === token.name) open.pop();
      else unbalancedTags.add(`<${token.name}>`);
    }
  }
  for (const name of open) unbalancedTags.add(`<${name}>`);

  return {
    unknownVars: [...unknownVars],
    unknownTags: [...unknownTags],
    unbalancedTags: [...unbalancedTags],
  };
}

/** Every `{name}` and `<tag>` a template uses, for tests and the editor. */
export function templateNames(template: string): {
  vars: string[];
  tags: string[];
} {
  const vars = new Set<string>();
  const tags = new Set<string>();
  for (const token of lex(template)) {
    if (token.kind === "var") vars.add(token.name);
    if (token.kind === "open" || token.kind === "close") tags.add(token.name);
  }
  return { vars: [...vars], tags: [...tags] };
}
