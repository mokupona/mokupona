import { fillTemplate, type TextVars } from "./format";
import { SITE_TEXTS, type SiteTextKey } from "./registry";

/** Admin edits by key; a key that's absent shows its default. */
export type SiteTextOverrides = Readonly<Record<string, string>>;

/**
 * Looks a text up by key and fills its `{name}` placeholders from `vars`.
 * Placeholders without a value are left in, for `<RichText>` to fill with
 * markup.
 */
export type Text = (key: SiteTextKey, vars?: TextVars) => string;

export function createText(overrides: SiteTextOverrides = {}): Text {
  return (key, vars) => {
    const override = Object.prototype.hasOwnProperty.call(overrides, key)
      ? overrides[key]
      : undefined;
    return fillTemplate(override ?? SITE_TEXTS[key].default, vars);
  };
}

/** The texts as written in the code, for tests and code with no request. */
export const defaultText: Text = createText();
