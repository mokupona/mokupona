/**
 * What every dinner needs and is easy to forget. A new event starts with
 * these on its admin checklist; each event's list can then be edited on its
 * own. Order is the order they're shown in.
 */
export const DEFAULT_CHECKLIST_ITEMS = [
  "Confirm the location",
  "Plan the menu",
  "Hire / ask a photographer",
  "Line up volunteers for cooking and serving",
  "Announce the dinner (newsletter, Instagram)",
  "Buy groceries and drinks",
  "Check payments are in",
  "Upload photos to the gallery",
] as const;

export const MAX_CHECKLIST_LABEL_LENGTH = 200;

/** A label as typed, trimmed; null when it's blank or too long. */
export function normalizeChecklistLabel(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const label = value.trim().replace(/\s+/g, " ");
  if (!label || label.length > MAX_CHECKLIST_LABEL_LENGTH) return null;
  return label;
}
