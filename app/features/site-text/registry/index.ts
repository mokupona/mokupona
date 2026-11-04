import type { SiteTextCategory, SiteTextEntry } from "../types";

import { aboutTexts } from "./about";
import { accountTexts } from "./account";
import { authTexts } from "./auth";
import { emailTexts } from "./emails";
import { eventsTexts } from "./events";
import { galleryTexts } from "./gallery";
import { inviteTexts } from "./invite";
import { landingTexts } from "./landing";
import { impressumTexts, privacyTexts } from "./legal";
import { musiTexts } from "./musi";
import { signupTexts } from "./signup";
import { siteTexts } from "./site";

/**
 * Every public-facing text on the site, by key. A key's first segment is its
 * category. Adding a text here is all the admin editor (/admin/texts) needs
 * to offer it; see CLAUDE.md, "Public-facing text".
 */
export const SITE_TEXTS = {
  ...siteTexts,
  ...landingTexts,
  ...eventsTexts,
  ...signupTexts,
  ...galleryTexts,
  ...aboutTexts,
  ...impressumTexts,
  ...privacyTexts,
  ...authTexts,
  ...inviteTexts,
  ...accountTexts,
  ...emailTexts,
  ...musiTexts,
} satisfies Record<string, SiteTextEntry>;

export type SiteTextKey = keyof typeof SITE_TEXTS;

/** The editor's sections, in the order it lists them. */
export const SITE_TEXT_CATEGORIES = [
  {
    id: "site",
    label: "Navigation, footer & site-wide",
    description:
      "The header, footer, phone menu, error pages and bits that repeat across pages.",
    path: "/",
  },
  {
    id: "landing",
    label: "Landing page",
    description: "The title card, the vision and the events teaser.",
    path: "/",
  },
  {
    id: "events",
    label: "Events",
    description: "The events list, event cards and an event's own page.",
    path: "/events",
  },
  {
    id: "signup",
    label: "Event signup",
    description:
      "The signup form on an event's page, its messages and pop-ups. The questions themselves are set per event.",
    path: "/events",
  },
  {
    id: "gallery",
    label: "Gallery",
    description: "The gallery, each event's album and the photo viewer.",
    path: "/gallery",
  },
  {
    id: "about",
    label: "About",
    description: "The about page around the hall of fame.",
    path: "/about",
  },
  {
    id: "impressum",
    label: "Impressum",
    description: "The legal notice.",
    path: "/impressum",
  },
  {
    id: "privacy",
    label: "Privacy policy",
    description: "The privacy policy.",
    path: "/privacy",
  },
  {
    id: "auth",
    label: "Log in & sign up",
    description:
      "Log in, sign up, forgotten and reset passwords, email verification and their error messages.",
    path: "/login",
  },
  {
    id: "invite",
    label: "Invites",
    description: "The page an invite link opens.",
  },
  {
    id: "account",
    label: "Account page",
    description: "What logged-in members see under “account”.",
    path: "/me",
  },
  {
    id: "emails",
    label: "Emails",
    description:
      "Verification, password reset, invite and event signup emails.",
  },
  {
    id: "musi",
    label: "musi (the hidden game)",
    description:
      "The whack-a-soweli game behind the glyphs on the landing page.",
    path: "/musi",
  },
] as const satisfies readonly SiteTextCategory[];

export type SiteTextCategoryId = (typeof SITE_TEXT_CATEGORIES)[number]["id"];

export function isSiteTextKey(key: string): key is SiteTextKey {
  return Object.prototype.hasOwnProperty.call(SITE_TEXTS, key);
}

export function categoryOf(key: SiteTextKey): SiteTextCategoryId {
  return key.slice(0, key.indexOf(".")) as SiteTextCategoryId;
}

export function getSiteTextCategory(
  id: string,
): (typeof SITE_TEXT_CATEGORIES)[number] | undefined {
  return SITE_TEXT_CATEGORIES.find((category) => category.id === id);
}

export function siteTextKeysIn(category: SiteTextCategoryId): SiteTextKey[] {
  return (Object.keys(SITE_TEXTS) as SiteTextKey[]).filter(
    (key) => categoryOf(key) === category,
  );
}

export function siteTextEntry(key: SiteTextKey): SiteTextEntry {
  return SITE_TEXTS[key];
}
