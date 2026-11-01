/**
 * The tables a live-data copy carries, in insert order (parents before the
 * rows that point at them). Shared by the export, the import and the admin
 * page, which is why nothing here pulls in server-only code.
 *
 * Deliberately absent: User, Session, Account, Verification, Invite and Role.
 * Accounts, password hashes, OAuth tokens and sessions never leave the live
 * site, and the copy target keeps its own logins untouched.
 */
export const LIVE_DATA_TABLES = [
  "addresses",
  "images",
  "forms",
  "formVersions",
  "formSubmissions",
  "events",
  "eventResponses",
  "eventGalleryImages",
  "boardMembers",
] as const;

export type LiveDataTable = (typeof LIVE_DATA_TABLES)[number];

export type LiveDataCounts = Record<LiveDataTable, number>;

export const LIVE_DATA_TABLE_LABELS: Record<LiveDataTable, string> = {
  addresses: "Locations",
  images: "Images",
  forms: "Signup forms",
  formVersions: "Signup form versions",
  formSubmissions: "Signups",
  events: "Events",
  eventResponses: "Signups (legacy)",
  eventGalleryImages: "Gallery photos",
  boardMembers: "Board members",
};
