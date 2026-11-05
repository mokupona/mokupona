// Client-safe: what a statistics hit is, and how the raw facts a browser
// reports (a path, a referrer, a window width) become the few labels the
// report groups by. The server applies these again to whatever arrives, so a
// beacon can't store anything the site wouldn't have sent itself.

import { z } from "zod";

import { EVENT_TIMEZONE } from "~/features/events/timezone";

/**
 * - `pageview`: a page of the public site was shown
 * - `signup_start`: the visitor first touched an event's signup form
 * - `signup_submit`: they pressed its submit button (valid or not)
 * - `signup`: the server stored their signup (recorded server-side only)
 * - `outbound`: they followed a link off the site (Instagram, a map …)
 */
export const STAT_KINDS = [
  "pageview",
  "signup_start",
  "signup_submit",
  "signup",
  "outbound",
] as const;
export type StatKind = (typeof STAT_KINDS)[number];

/** Everything but `signup`, which only the server can vouch for. */
const BEACON_KINDS = [
  "pageview",
  "signup_start",
  "signup_submit",
  "outbound",
] as const satisfies readonly StatKind[];
export type BeaconKind = (typeof BEACON_KINDS)[number];

/** The body the tracker posts to /api/stats. */
export const BeaconSchema = z.object({
  kind: z.enum(BEACON_KINDS),
  path: z.string().max(512),
  /** the previous page, when the visitor navigated within the site */
  from: z.string().max(512).optional(),
  /** document.referrer, on the first page of a visit */
  referrer: z.string().max(2048).optional(),
  /** the link's own `?src=` (or `utm_source`) */
  source: z.string().max(128).optional(),
  width: z.number().int().min(0).max(100_000).optional(),
  /** for `outbound`: the link's host */
  detail: z.string().max(253).optional(),
});
export type Beacon = z.infer<typeof BeaconSchema>;

const ID = "[A-Za-z0-9_-]{1,64}";

/**
 * The public pages worth counting, each mapped to what gets stored. Anything
 * else (the admin area, API and file routes, 404s) is not a page view, and
 * an invite link's token is a secret, so only the bare `/invite` is kept.
 */
const COUNTED_PAGES: [RegExp, (match: RegExpMatchArray) => string][] = [
  [/^\/$/, () => "/"],
  [/^\/events$/, () => "/events"],
  [new RegExp(`^/events/(${ID})$`), ([, id]) => `/events/${id}`],
  [
    new RegExp(`^/events/(${ID})/gallery$`),
    ([, id]) => `/events/${id}/gallery`,
  ],
  [
    /^\/(gallery|about|musi|privacy|impressum|login|join|forgot-password|reset-password|check-your-inbox|verify-email|me)$/,
    ([path]) => path,
  ],
  [new RegExp(`^/invite/${ID}$`), () => "/invite"],
];

/** The path a hit is stored under, or null when the page isn't counted. */
export function countedPath(pathname: string): string | null {
  const path =
    pathname.length > 1 && pathname.endsWith("/")
      ? pathname.slice(0, -1)
      : pathname;

  for (const [pattern, toStored] of COUNTED_PAGES) {
    const match = path.match(pattern);
    if (match) return toStored(match);
  }
  return null;
}

/** The event a counted path belongs to: its page or its album. */
export function eventIdForPath(path: string): string | null {
  return path.match(new RegExp(`^/events/(${ID})(?:/gallery)?$`))?.[1] ?? null;
}

export function isEventGalleryPath(path: string) {
  return path.endsWith("/gallery") && eventIdForPath(path) !== null;
}

export type Device = "mobile" | "tablet" | "desktop" | "unknown";

/** Tailwind's md and lg breakpoints, the same cut the layouts make. */
export function deviceForWidth(width: number | undefined): Device {
  if (width === undefined || width === 0) return "unknown";
  if (width < 768) return "mobile";
  if (width < 1024) return "tablet";
  return "desktop";
}

/**
 * Sites people arrive from, by the host's registrable part. Everything not
 * listed is stored under its own host.
 */
const KNOWN_REFERRERS: [RegExp, string][] = [
  [/(^|\.)instagram\.com$/, "instagram"],
  [/(^|\.)(facebook\.com|fb\.me)$/, "facebook"],
  [/(^|\.)(whatsapp\.com|wa\.me)$/, "whatsapp"],
  [/(^|\.)(t\.me|telegram\.org)$/, "telegram"],
  [/(^|\.)(t\.co|x\.com|twitter\.com)$/, "x"],
  [/(^|\.)(linkedin\.com|lnkd\.in)$/, "linkedin"],
  [/(^|\.)google\.[a-z.]+$/, "google"],
  [/(^|\.)bing\.com$/, "bing"],
  [/(^|\.)duckduckgo\.com$/, "duckduckgo"],
  [/(^|\.)ecosia\.org$/, "ecosia"],
];

/** A `?src=` value as stored: lower case, a short slug. */
export function normalizeSource(value: string): string | null {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
  // "internal" and "direct" mean something here already
  if (!slug || slug === "internal" || slug === "direct") return null;
  return slug;
}

function hostOf(url: string): string | null {
  try {
    const { protocol, hostname } = new URL(url);
    if (protocol !== "http:" && protocol !== "https:") return null;
    return hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
}

/**
 * How a page view arrived. A tagged link (`?src=qr`) wins: it was put there
 * on purpose. Then a step from another page of the site, then the referring
 * site. With none of these, the visit is direct: typed, bookmarked, or opened
 * from an app that sends no referrer (WhatsApp, Signal, mail apps).
 */
export function classifySource({
  source,
  from,
  referrer,
  siteHost,
}: {
  source?: string;
  from?: string;
  referrer?: string;
  siteHost: string;
}): { source: string; referrer: string | null } {
  const tagged = source ? normalizeSource(source) : null;
  if (tagged) return { source: tagged, referrer: null };

  const previous = from ? countedPath(from) : null;
  if (previous) return { source: "internal", referrer: previous };

  const host = referrer ? hostOf(referrer) : null;
  if (host) {
    if (host === siteHost.toLowerCase().replace(/^www\./, "")) {
      // a full page load from our own page, e.g. after a form post
      return {
        source: "internal",
        referrer: countedPath(new URL(referrer!).pathname),
      };
    }
    const known = KNOWN_REFERRERS.find(([pattern]) => pattern.test(host));
    return { source: known ? known[1] : host, referrer: host };
  }

  return { source: "direct", referrer: null };
}

/** An outbound link's host as stored, or null for anything not a web link. */
export function outboundHost(value: string | undefined): string | null {
  if (!value) return null;
  const host = value
    .trim()
    .toLowerCase()
    .replace(/^www\./, "");
  return /^[a-z0-9.-]{1,253}$/.test(host) && host.includes(".") ? host : null;
}

const dayFormat = new Intl.DateTimeFormat("en-CA", {
  timeZone: EVENT_TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** The Zürich calendar day of `date`, as "2026-11-05". */
export function statsDay(date: Date): string {
  return dayFormat.format(date);
}

/** `day` moved by whole calendar days, without any clock in between. */
export function addDays(day: string, amount: number): string {
  const [year, month, date] = day.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, date + amount))
    .toISOString()
    .slice(0, 10);
}
