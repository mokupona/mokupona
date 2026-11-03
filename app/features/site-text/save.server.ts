import {
  SITE_TEXTS,
  siteTextKeysIn,
  type SiteTextCategoryId,
} from "./registry";
import { validateSiteText } from "./validate";

import { listSiteTexts, saveSiteTexts } from "~/models/site-text.server";

export type SaveSiteTextsResult =
  | { ok: true; changedKeys: string[] }
  | { ok: false; errors: Record<string, string> };

/**
 * Stores what the editor submitted for one category: a text typed back to
 * its default loses its row (so later changes to the default reach it), any
 * other value is kept as the admin's version. Nothing is written unless
 * every text in the form passes.
 *
 * Saving also files away the current default next to each kept edit, which
 * is how the editor tells an admin that a default changed under their edit
 * and stops telling them once they've saved over it.
 */
export async function saveSiteTextCategory(
  category: SiteTextCategoryId,
  formData: FormData,
): Promise<SaveSiteTextsResult> {
  const stored = new Map((await listSiteTexts()).map((row) => [row.key, row]));
  const errors: Record<string, string> = {};
  const upserts: { key: string; value: string; defaultAtEdit: string }[] = [];
  const removals: string[] = [];

  for (const key of siteTextKeysIn(category)) {
    const raw = formData.get(key);
    if (typeof raw !== "string") continue;

    const result = validateSiteText(key, raw);
    if (!result.ok) {
      errors[key] = result.error;
      continue;
    }

    const defaultValue = SITE_TEXTS[key].default;
    const row = stored.get(key);

    if (result.value === defaultValue) {
      if (row) removals.push(key);
    } else if (
      !row ||
      row.value !== result.value ||
      row.defaultAtEdit !== defaultValue
    ) {
      upserts.push({ key, value: result.value, defaultAtEdit: defaultValue });
    }
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  if (upserts.length > 0 || removals.length > 0) {
    await saveSiteTexts({ upserts, removals });
  }

  return {
    ok: true,
    changedKeys: [...upserts.map((upsert) => upsert.key), ...removals],
  };
}
