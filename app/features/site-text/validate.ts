import { checkTemplate } from "./format";
import { SITE_TEXTS, type SiteTextKey } from "./registry";
import type { SiteTextEntry } from "./types";

const MAX_LENGTH = { line: 500, paragraph: 5_000, document: 100_000 } as const;

export type SiteTextValidation =
  { ok: true; value: string } | { ok: false; error: string };

function list(items: string[]) {
  return items.join(", ");
}

/**
 * Normalises what an admin typed for `key` and checks it against what the
 * text's page can fill in. The messages are for the admin editor.
 */
export function validateSiteText(
  key: SiteTextKey,
  raw: string,
): SiteTextValidation {
  const entry: SiteTextEntry = SITE_TEXTS[key];
  const kind = entry.kind ?? "line";

  // browsers submit textarea line breaks as CRLF; a one-line text has none
  let value = raw.replace(/\r\n?/g, "\n");
  value =
    kind === "line" ? value.replace(/\s*\n\s*/g, " ").trim() : value.trim();

  if (!value && !entry.optional) {
    return {
      ok: false,
      error: "This text can't be blank. Reset it to bring the default back.",
    };
  }

  if (value.length > MAX_LENGTH[kind]) {
    return {
      ok: false,
      error: `Keep it under ${MAX_LENGTH[kind].toLocaleString("en")} characters.`,
    };
  }

  const vars = Object.keys(entry.vars ?? {});
  const tags = Object.keys(entry.tags ?? {});
  const problems = checkTemplate(value, { vars, tags });
  const errors: string[] = [];

  if (problems.unknownVars.length > 0) {
    errors.push(
      vars.length > 0
        ? `Unknown placeholder ${list(problems.unknownVars)} — this text can use ${list(vars.map((name) => `{${name}}`))}.`
        : `Unknown placeholder ${list(problems.unknownVars)} — this text has none to fill in.`,
    );
  }
  if (problems.unknownTags.length > 0) {
    errors.push(
      tags.length > 0
        ? `Unknown tag ${list(problems.unknownTags)} — this text can use ${list(tags.map((name) => `<${name}>…</${name}>`))}.`
        : `Unknown tag ${list(problems.unknownTags)} — this text can't contain tags.`,
    );
  }
  if (problems.unbalancedTags.length > 0) {
    errors.push(
      `Every ${list(problems.unbalancedTags)} needs a matching closing tag, e.g. <link>privacy policy</link>.`,
    );
  }

  return errors.length > 0
    ? { ok: false, error: errors.join(" ") }
    : { ok: true, value };
}
