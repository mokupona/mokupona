import { describe, expect, it } from "vitest";

import {
  CHECKLIST_CATEGORIES,
  DEFAULT_CHECKLIST_ITEMS,
  groupChecklistByCategory,
  normalizeChecklistLabel,
  parseChecklistCategory,
} from "./checklist";

describe("parseChecklistCategory", () => {
  it("accepts the known categories", () => {
    for (const { value } of CHECKLIST_CATEGORIES) {
      expect(parseChecklistCategory(value)).toBe(value);
    }
  });

  it("refuses anything else", () => {
    expect(parseChecklistCategory("Menu")).toBeNull();
    expect(parseChecklistCategory("")).toBeNull();
    expect(parseChecklistCategory(null)).toBeNull();
    expect(parseChecklistCategory(undefined)).toBeNull();
  });
});

describe("normalizeChecklistLabel", () => {
  it("trims and collapses spaces", () => {
    expect(normalizeChecklistLabel("  Buy   wine ")).toBe("Buy wine");
  });

  it("refuses blank or overlong labels", () => {
    expect(normalizeChecklistLabel("   ")).toBeNull();
    expect(normalizeChecklistLabel("x".repeat(201))).toBeNull();
    expect(normalizeChecklistLabel(42)).toBeNull();
  });
});

describe("groupChecklistByCategory", () => {
  it("lists every category in order, empty ones too", () => {
    const groups = groupChecklistByCategory([]);

    expect(groups.map((group) => group.category)).toEqual([
      "general",
      "logistics",
      "decorations",
      "socials",
      "menu",
    ]);
    expect(groups.every((group) => group.items.length === 0)).toBe(true);
  });

  it("keeps each category's items in the order they came", () => {
    const groups = groupChecklistByCategory(DEFAULT_CHECKLIST_ITEMS);
    const labelsOf = (category: string) =>
      groups
        .find((group) => group.category === category)!
        .items.map((item) => item.label);

    expect(labelsOf("menu")).toEqual([
      "Plan the menu",
      "Buy groceries and drinks",
    ]);
    expect(labelsOf("socials")).toEqual([
      "Hire / ask a photographer",
      "Announce the dinner (newsletter, Instagram)",
      "Upload photos to the gallery",
    ]);
  });

  it("puts an item with an unknown category under general", () => {
    const groups = groupChecklistByCategory([{ id: "a", category: "flowers" }]);

    expect(groups[0]).toMatchObject({
      category: "general",
      items: [{ id: "a" }],
    });
  });
});
