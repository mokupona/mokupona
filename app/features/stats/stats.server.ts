import { createHmac, randomBytes } from "node:crypto";
import { isIP } from "node:net";

import { isbot } from "isbot";

import { statsDay, type Device, type StatKind } from "./hit";

import type { ValidatedUser } from "~/features/auth/guards.server";
import { ADMIN_ROLE_NAMES } from "~/features/auth/roles";
import { requestLogger } from "~/logger/request-context.server";
import { createStatHit } from "~/models/stat-hit.server";
import { getClientIPAddress } from "~/shared/http.server";

/**
 * Marks a browser the team uses, so its visits stay out of the statistics
 * even after its moderator or admin signs out. Set the first time a staff
 * member is seen in it; a browser keeps a cookie at most 400 days, and the
 * next staff visit after that sets it again. A plain `1`, nothing secret: a
 * visitor who sets it on purpose only leaves themselves out.
 */
export const STAFF_BROWSER_COOKIE = "stats_exclude";

const STAFF_BROWSER_MAX_AGE = 400 * 24 * 60 * 60;

function isMarkedBrowser(request: Request) {
  return (request.headers.get("Cookie") ?? "")
    .split(";")
    .some((pair) => pair.trim() === `${STAFF_BROWSER_COOKIE}=1`);
}

function markBrowserCookie() {
  return [
    `${STAFF_BROWSER_COOKIE}=1`,
    "Path=/",
    `Max-Age=${STAFF_BROWSER_MAX_AGE}`,
    "HttpOnly",
    "SameSite=Lax",
    ...(process.env.NODE_ENV === "production" ? ["Secure"] : []),
  ].join("; ");
}

export function isStaff(user: ValidatedUser | null) {
  return ADMIN_ROLE_NAMES.some((role) => role === user?.role.name);
}

export interface StatsTracking {
  /** whether this browser's visits are left out */
  excluded: boolean;
  /** a Set-Cookie value that marks the browser as staff, when it isn't yet */
  markBrowser: string | null;
}

/**
 * Decides whether a request counts. Staff (signed in now, or ever in this
 * browser) and bots are left out; a staff request in an unmarked browser
 * also gets the cookie that keeps it left out.
 */
export async function statsTrackingFor(
  request: Request,
  user: ValidatedUser | null,
): Promise<StatsTracking> {
  const marked = isMarkedBrowser(request);

  if (isStaff(user)) {
    return { excluded: true, markBrowser: marked ? null : markBrowserCookie() };
  }

  const userAgent = request.headers.get("User-Agent");
  return {
    excluded: marked || !userAgent || isbot(userAgent),
    markBrowser: null,
  };
}

function parseAddress(value: string | null | undefined) {
  const address = value?.trim().toLowerCase();
  return address && isIP(address) ? address : null;
}

/**
 * The visitor's address as the proxy in front of the app saw it: Fly's
 * header where it still runs there, the `X-Real-IP` and first
 * `X-Forwarded-For` entry Railway's edge sets otherwise. Only ever hashed.
 */
function visitorAddress(request: Request) {
  return (
    getClientIPAddress(request) ??
    parseAddress(request.headers.get("X-Real-IP")) ??
    parseAddress(request.headers.get("X-Forwarded-For")?.split(",")[0]) ??
    ""
  );
}

// One random key per calendar day, held in memory only. Once the day is
// over the key is gone, and with it any way to tie a visitor code to an
// address or to the same browser's visits on other days. A restart draws a
// new key, so a visitor can count twice on a day the app was redeployed.
let saltDay = "";
let salt = randomBytes(32);

function saltFor(day: string) {
  if (day !== saltDay) {
    saltDay = day;
    salt = randomBytes(32);
  }
  return salt;
}

/** A code that stays the same for one browser on one day, and only then. */
export function visitorCode(request: Request, day: string) {
  return createHmac("sha256", saltFor(day))
    .update(visitorAddress(request))
    .update("\n")
    .update(request.headers.get("User-Agent") ?? "")
    .digest("base64url")
    .slice(0, 22);
}

export interface StatHitInput {
  kind: StatKind;
  path: string;
  eventId: string | null;
  source: string;
  referrer: string | null;
  device: Device;
  detail: string | null;
}

/**
 * Stores one hit. Statistics never get in the way of the page: a failure is
 * logged and swallowed.
 */
export async function recordStatHit(
  request: Request,
  hit: StatHitInput,
  now = new Date(),
) {
  const day = statsDay(now);
  try {
    await createStatHit({
      ...hit,
      day,
      visitor: visitorCode(request, day),
      createdAt: now,
    });
  } catch (error) {
    requestLogger.error(
      { error, kind: hit.kind },
      "Failed to record a statistics hit",
    );
  }
}

/**
 * Records a hit only the server can vouch for (a stored signup), unless the
 * browser is left out. Like recordStatHit, it never throws: the guest's
 * signup is already stored and must not fail over a statistic.
 */
export async function recordServerStatHit(
  request: Request,
  resolveUser: () => Promise<ValidatedUser | null>,
  hit: StatHitInput,
) {
  try {
    const tracking = await statsTrackingFor(request, await resolveUser());
    if (!tracking.excluded) await recordStatHit(request, hit);
  } catch (error) {
    requestLogger.error(
      { error, kind: hit.kind },
      "Failed to record a statistics hit",
    );
  }
}
