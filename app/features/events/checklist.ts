/**
 * The parts of a dinner the organisers' checklist is split into, in the order
 * they're shown. The value is what's stored on each item.
 */
export const CHECKLIST_CATEGORIES = [
  { value: "general", label: "General" },
  { value: "logistics", label: "Logistics" },
  { value: "decorations", label: "Decorations" },
  { value: "socials", label: "Socials" },
  { value: "menu", label: "Menu" },
] as const;

export type ChecklistCategory = (typeof CHECKLIST_CATEGORIES)[number]["value"];

/** Where an item goes when nobody said otherwise. */
export const DEFAULT_CHECKLIST_CATEGORY: ChecklistCategory = "general";

export function isChecklistCategory(
  value: unknown,
): value is ChecklistCategory {
  return CHECKLIST_CATEGORIES.some((category) => category.value === value);
}

/** The category as sent by a form; null when it isn't one we know. */
export function parseChecklistCategory(
  value: unknown,
): ChecklistCategory | null {
  return isChecklistCategory(value) ? value : null;
}

/**
 * What every dinner needs and is easy to forget. A new event starts with
 * these on its admin checklist; each event's list can then be edited on its
 * own. Within a category, order is the order they're shown in.
 */
export const DEFAULT_CHECKLIST_ITEMS = [
  { label: "Confirm the location", category: "logistics" },
  { label: "Plan the menu", category: "menu" },
  { label: "Hire / ask a photographer", category: "socials" },
  {
    label: "Line up volunteers for cooking and serving",
    category: "logistics",
  },
  { label: "Announce the dinner (newsletter, Instagram)", category: "socials" },
  { label: "Buy groceries and drinks", category: "menu" },
  { label: "Check payments are in", category: "general" },
  { label: "Upload photos to the gallery", category: "socials" },
] as const satisfies ReadonlyArray<{
  label: string;
  category: ChecklistCategory;
}>;

export const MAX_CHECKLIST_LABEL_LENGTH = 200;

/** A label as typed, trimmed; null when it's blank or too long. */
export function normalizeChecklistLabel(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const label = value.trim().replace(/\s+/g, " ");
  if (!label || label.length > MAX_CHECKLIST_LABEL_LENGTH) return null;
  return label;
}

/**
 * Splits a checklist into its categories, every category present (empty ones
 * too) and in the order above. Items keep the order they came in; one with a
 * category we don't know lands in the default one.
 */
export function groupChecklistByCategory<T extends { category: string }>(
  items: readonly T[],
): Array<{ category: ChecklistCategory; label: string; items: T[] }> {
  const groups = CHECKLIST_CATEGORIES.map(({ value, label }) => ({
    category: value as ChecklistCategory,
    label: label as string,
    items: [] as T[],
  }));

  for (const item of items) {
    const category =
      parseChecklistCategory(item.category) ?? DEFAULT_CHECKLIST_CATEGORY;
    groups.find((group) => group.category === category)!.items.push(item);
  }

  return groups;
}
