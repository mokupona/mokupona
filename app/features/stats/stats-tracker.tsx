import { useEffect, useRef } from "react";
import { useLocation } from "react-router";

import { countedPath, type Beacon } from "./hit";
import { SOURCE_PARAM } from "./source";

const ENDPOINT = "/api/stats";

// set by <StatsTracker>, so components can report a step without each
// knowing whether this browser is counted
let enabled = false;

/**
 * Reports one hit. A no-op until the tracker has mounted in a counted
 * browser, on pages that aren't counted, and on the server.
 */
export function trackStat(beacon: Beacon) {
  if (!enabled || typeof window === "undefined") return;
  if (!countedPath(beacon.path)) return;

  const body = JSON.stringify(beacon);
  // sendBeacon survives the page being left right after, as a click on an
  // outbound link does; a plain string goes as text/plain, so no preflight
  if (navigator.sendBeacon?.(ENDPOINT, body)) return;
  void fetch(ENDPOINT, { method: "POST", body, keepalive: true }).catch(
    () => {},
  );
}

/** document.referrer, unless it is one of our own pages. */
function externalReferrer() {
  if (!document.referrer) return undefined;
  try {
    const url = new URL(document.referrer);
    return url.origin === window.location.origin ? undefined : url.href;
  } catch {
    return undefined;
  }
}

/**
 * Counts page views for the admin statistics (app/routes/admin.stats.tsx)
 * and follows clicks on links that leave the site. Page views are sent from
 * the browser rather than counted in loaders, so link prefetching, data
 * revalidation and crawlers that don't run scripts never add to them.
 */
export function StatsTracker({ track }: { track: boolean }) {
  const location = useLocation();
  const previous = useRef<string | null>(null);

  useEffect(() => {
    enabled = track;
  }, [track]);

  useEffect(() => {
    if (!track) return;
    const path = location.pathname;
    // a new search or hash on the same page isn't a new page
    if (previous.current === path) return;
    const from = previous.current ?? undefined;
    previous.current = path;

    const params = new URLSearchParams(location.search);
    const source =
      params.get(SOURCE_PARAM) ?? params.get("utm_source") ?? undefined;

    trackStat({
      kind: "pageview",
      path,
      from,
      referrer: from ? undefined : externalReferrer(),
      source,
      width: window.innerWidth,
    });

    if (params.has(SOURCE_PARAM)) {
      // take the tag back off, so a link copied from the address bar and
      // shared on isn't counted as another scan. The router isn't told:
      // nothing reads the tag, and telling it would reload the page's data.
      const url = new URL(window.location.href);
      url.searchParams.delete(SOURCE_PARAM);
      window.history.replaceState(window.history.state, "", url);
    }
  }, [track, location.pathname, location.search]);

  useEffect(() => {
    if (!track) return;

    function onClick(event: MouseEvent) {
      const link =
        event.target instanceof Element
          ? event.target.closest<HTMLAnchorElement>("a[href]")
          : null;
      if (!link) return;
      const url = new URL(link.href, window.location.href);
      if (url.protocol !== "http:" && url.protocol !== "https:") return;
      if (url.origin === window.location.origin) return;

      trackStat({
        kind: "outbound",
        path: window.location.pathname,
        detail: url.hostname,
      });
    }

    // capture, so a link whose own handler stops the event still counts
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [track]);

  return null;
}
