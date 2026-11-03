/**
 * One editable text. The code supplies `default`; an admin's edit, when there
 * is one, is stored in the SiteText table and wins.
 */
export interface SiteTextEntry {
  /** What the editor calls the text, e.g. "Intro paragraph". */
  label: string;
  default: string;
  /** Where it shows or when, if the label alone doesn't make that clear. */
  hint?: string;
  /**
   * "line" is a single line, "paragraph" may span lines, "document" is a
   * whole page written in the markup described in ./document.ts.
   */
  kind?: "line" | "paragraph" | "document";
  /** `{name}` placeholders the page fills in, with what each one holds. */
  vars?: Record<string, string>;
  /** `<tag>…</tag>` spans the page wraps, with what each one becomes. */
  tags?: Record<string, string>;
  /** May be saved blank; the page then leaves the element out. */
  optional?: boolean;
}

export interface SiteTextCategory {
  id: string;
  label: string;
  description: string;
  /** A page to check the texts on, when the category has one. */
  path?: string;
}

type Prefixed<Prefix extends string, Entries> = {
  [Key in keyof Entries & string as `${Prefix}.${Key}`]: Entries[Key];
};

/**
 * Declares a category's texts. Keys are written relative to the category and
 * come out prefixed with its id, e.g. `landing.vision.headline`.
 */
export function defineTexts<
  const Prefix extends string,
  Entries extends Record<string, SiteTextEntry>,
>(prefix: Prefix, entries: Entries): Prefixed<Prefix, Entries> {
  return Object.fromEntries(
    Object.entries(entries).map(([key, entry]) => [`${prefix}.${key}`, entry]),
  ) as Prefixed<Prefix, Entries>;
}
