import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { checkTemplate } from "./format";
import {
  categoryOf,
  SITE_TEXT_CATEGORIES,
  SITE_TEXTS,
  siteTextKeysIn,
  type SiteTextKey,
} from "./registry";
import type { SiteTextEntry } from "./types";
import { validateSiteText } from "./validate";

const KEYS = Object.keys(SITE_TEXTS) as SiteTextKey[];
const APP_DIR = path.resolve(__dirname, "../..");
const REGISTRY_DIR = path.resolve(__dirname, "registry");

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) {
      return full === REGISTRY_DIR ? [] : sourceFiles(full);
    }
    return /\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)
      ? [full]
      : [];
  });
}

describe("the site-text registry", () => {
  it("files every text under a category the editor lists", () => {
    const categoryIds = new Set<string>(
      SITE_TEXT_CATEGORIES.map((category) => category.id),
    );
    const orphans = KEYS.filter((key) => !categoryIds.has(categoryOf(key)));
    expect(orphans).toEqual([]);
  });

  it("has no empty category", () => {
    const empty = SITE_TEXT_CATEGORIES.filter(
      (category) => siteTextKeysIn(category.id).length === 0,
    ).map((category) => category.id);
    expect(empty).toEqual([]);
  });

  it("gives the texts of a category distinct labels", () => {
    for (const category of SITE_TEXT_CATEGORIES) {
      const labels = siteTextKeysIn(category.id).map(
        (key) => SITE_TEXTS[key].label,
      );
      const duplicates = labels.filter(
        (label, index) => labels.indexOf(label) !== index,
      );
      expect(duplicates, category.id).toEqual([]);
    }
  });

  it("only uses the placeholders and tags each text declares", () => {
    const broken = KEYS.flatMap((key) => {
      const entry: SiteTextEntry = SITE_TEXTS[key];
      const problems = checkTemplate(entry.default, {
        vars: Object.keys(entry.vars ?? {}),
        tags: Object.keys(entry.tags ?? {}),
      });
      const found = [
        ...problems.unknownVars,
        ...problems.unknownTags,
        ...problems.unbalancedTags,
      ];
      return found.length > 0 ? [`${key}: ${found.join(", ")}`] : [];
    });
    expect(broken).toEqual([]);
  });

  it("would accept every default if an admin typed it", () => {
    const refused = KEYS.flatMap((key) => {
      const result = validateSiteText(key, SITE_TEXTS[key].default);
      if (!result.ok) return [`${key}: ${result.error}`];
      // and saving it back leaves it exactly as the code has it
      return result.value === SITE_TEXTS[key].default
        ? []
        : [`${key}: normalises to something else`];
    });
    expect(refused).toEqual([]);
  });

  // A text the code no longer shows would sit in the editor doing nothing.
  // Remove its entry along with the last place that used it.
  it("has every text in use somewhere in app/", () => {
    const source = sourceFiles(APP_DIR)
      .map((file) => readFileSync(file, "utf8"))
      .join("\n");
    const unused = KEYS.filter((key) => !source.includes(`"${key}"`));
    expect(unused).toEqual([]);
  });
});
