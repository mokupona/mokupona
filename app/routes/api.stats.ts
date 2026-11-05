import type { Route } from "./+types/api.stats";

import { optionalUserContext } from "~/features/auth/middleware.server";
import {
  BeaconSchema,
  classifySource,
  countedPath,
  deviceForWidth,
  eventIdForPath,
  outboundHost,
} from "~/features/stats/hit";
import { recordStatHit, statsTrackingFor } from "~/features/stats/stats.server";
import { statEventExists } from "~/models/stat-hit.server";
import { getDomainUrl } from "~/shared/http.server";

/** Larger than any beacon the tracker sends. */
const MAX_BODY_BYTES = 4096;

function noContent(headers?: HeadersInit) {
  return new Response(null, { status: 204, headers });
}

/**
 * Where the stats tracker (app/features/stats/stats-tracker.tsx) reports a
 * page view or a step of a signup. Always answers 204 for a well-formed
 * beacon, counted or not, so a page can't tell whether it is being counted.
 */
export async function action({ request, context }: Route.ActionArgs) {
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  // the tracker only ever posts from the site's own pages
  const fetchSite = request.headers.get("Sec-Fetch-Site");
  if (fetchSite && fetchSite !== "same-origin") return noContent();

  const body = await request.text();
  if (body.length > MAX_BODY_BYTES) {
    return new Response("Payload too large", { status: 413 });
  }

  let json: unknown;
  try {
    json = JSON.parse(body);
  } catch {
    return new Response("Bad request", { status: 400 });
  }
  const parsed = BeaconSchema.safeParse(json);
  if (!parsed.success) return new Response("Bad request", { status: 400 });
  const beacon = parsed.data;

  const user = await context.get(optionalUserContext)();
  const tracking = await statsTrackingFor(request, user);
  const headers = tracking.markBrowser
    ? { "Set-Cookie": tracking.markBrowser }
    : undefined;
  if (tracking.excluded) return noContent(headers);

  const path = countedPath(beacon.path);
  if (!path) return noContent();

  const eventId = eventIdForPath(path);
  if (eventId && !(await statEventExists(eventId))) return noContent();

  const detail =
    beacon.kind === "outbound" ? outboundHost(beacon.detail) : null;
  if (beacon.kind === "outbound" && !detail) return noContent();

  const { source, referrer } =
    beacon.kind === "pageview"
      ? classifySource({
          source: beacon.source,
          from: beacon.from,
          referrer: beacon.referrer,
          siteHost: new URL(getDomainUrl(request)).hostname,
        })
      : { source: "internal", referrer: null };

  await recordStatHit(request, {
    kind: beacon.kind,
    path,
    eventId,
    source,
    referrer,
    device: deviceForWidth(beacon.width),
    detail,
  });

  return noContent();
}

export function loader() {
  return new Response("Method not allowed", { status: 405 });
}
