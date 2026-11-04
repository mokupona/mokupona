import { isSiteTextKey } from "./registry";
import { createText, type SiteTextOverrides, type Text } from "./text";

import { listSiteTexts } from "~/models/site-text.server";

/**
 * The admin's edits that still belong to a text in the registry. A row left
 * behind by a text the code no longer has is ignored rather than shipped.
 */
export async function getSiteTextOverrides(): Promise<SiteTextOverrides> {
  const rows = await listSiteTexts();
  return Object.fromEntries(
    rows
      .filter((row) => isSiteTextKey(row.key))
      .map((row) => [row.key, row.value]),
  );
}

/** The site texts for server code: actions, toasts and mails. */
export async function getText(): Promise<Text> {
  return createText(await getSiteTextOverrides());
}
