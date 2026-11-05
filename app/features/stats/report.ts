// Admin-only: turns the counted rows into the statistics page's report. Pure,
// so the arithmetic is tested without a database; report.server.ts does the
// loading.

import { addDays, eventIdForPath, type Device } from "./hit";

export const STAT_PERIODS = [7, 30, 90, 365] as const;
export type StatPeriod = (typeof STAT_PERIODS)[number];
export const DEFAULT_STAT_PERIOD: StatPeriod = 30;

export function parseStatPeriod(value: string | null): StatPeriod {
  const days = Number(value);
  return STAT_PERIODS.find((period) => period === days) ?? DEFAULT_STAT_PERIOD;
}

interface CountRow {
  hits: number;
  visitors: number;
}

export interface StatRows {
  byKind: (CountRow & { kind: string })[];
  previousByKind: (CountRow & { kind: string })[];
  byDay: (CountRow & { day: string })[];
  funnels: (CountRow & { eventId: string; kind: string })[];
  eventSources: (CountRow & {
    eventId: string;
    source: string;
    referrer: string | null;
  })[];
  entrySources: (CountRow & { source: string })[];
  previousEntrySources: (CountRow & { source: string })[];
  byPath: (CountRow & { path: string; eventId: string | null })[];
  byDevice: (CountRow & { device: string })[];
  outbound: (CountRow & { detail: string })[];
  events: { id: string; title: string; date: Date }[];
}

export interface Metric {
  value: number;
  /** the same figure over the period just before */
  previous: number;
}

export interface ChartBucket {
  /** first and last day the bucket covers */
  start: string;
  end: string;
  visitors: number;
  pageviews: number;
}

export interface SourceShare {
  key: string;
  label: string;
  visitors: number;
}

export interface EventStats {
  id: string;
  title: string;
  date: string;
  upcoming: boolean;
  /** distinct visitors at each step of the way to a seat */
  visitors: number;
  started: number;
  submitted: number;
  signedUp: number;
  /** how this event's visitors found its page, most first */
  sources: SourceShare[];
}

export interface StatsReport {
  period: { days: StatPeriod; from: string; to: string };
  totals: {
    visitors: Metric;
    pageviews: Metric;
    signups: Metric;
    qrScans: Metric;
  };
  chart: { unit: "day" | "week"; buckets: ChartBucket[] };
  events: EventStats[];
  sources: (SourceShare & { visits: number })[];
  pages: { path: string; label: string; visitors: number; pageviews: number }[];
  devices: { device: Device; label: string; visitors: number }[];
  outbound: { host: string; label: string; clicks: number; visitors: number }[];
}

/** The range a period covers, ending today, and the one right before it. */
export function statRanges(days: StatPeriod, today: string) {
  const from = addDays(today, -(days - 1));
  return {
    current: { from, to: today },
    previous: { from: addDays(from, -days), to: addDays(from, -1) },
  };
}

const SOURCE_LABELS: Record<string, string> = {
  qr: "QR code",
  instagram: "Instagram",
  facebook: "Facebook",
  whatsapp: "WhatsApp",
  telegram: "Telegram",
  x: "X / Twitter",
  linkedin: "LinkedIn",
  google: "Google",
  bing: "Bing",
  duckduckgo: "DuckDuckGo",
  ecosia: "Ecosia",
  direct: "Direct or an app",
  internal: "Elsewhere on the site",
};

/** A source's name on the page: known ones by name, hosts as they are. */
export function sourceLabel(key: string) {
  if (SOURCE_LABELS[key]) return SOURCE_LABELS[key];
  // a host has a dot; anything else came in on a hand-made ?src= link
  return key.includes(".") ? key : `Link tagged “${key}”`;
}

/** Which page of the site sent a visitor on to an event's page. */
function internalSourceLabel(referrer: string | null, eventId: string) {
  if (referrer === "/") return { key: "page:/", label: "Landing page" };
  if (referrer === "/events")
    return { key: "page:/events", label: "Events list" };
  if (referrer === "/gallery")
    return { key: "page:/gallery", label: "Gallery" };
  if (referrer && eventIdForPath(referrer) === eventId) {
    return { key: "page:album", label: "Its own album" };
  }
  if (referrer && eventIdForPath(referrer)) {
    return { key: "page:event", label: "Another event" };
  }
  return { key: "page:other", label: "Elsewhere on the site" };
}

const PAGE_LABELS: Record<string, string> = {
  "/": "Landing page",
  "/events": "Events list",
  "/gallery": "Gallery",
  "/about": "About",
  "/musi": "musi (the game)",
  "/privacy": "Privacy policy",
  "/impressum": "Impressum",
  "/login": "Log in",
  "/join": "Create an account",
  "/forgot-password": "Forgot password",
  "/reset-password": "Reset password",
  "/check-your-inbox": "Check your inbox",
  "/verify-email": "Verify email",
  "/me": "Account",
  "/invite": "Invite links",
};

function pageLabel(path: string, titles: Map<string, string>) {
  const eventId = eventIdForPath(path);
  if (eventId) {
    const title = titles.get(eventId) ?? "Deleted event";
    return path.endsWith("/gallery") ? `Album: ${title}` : `Event: ${title}`;
  }
  return PAGE_LABELS[path] ?? path;
}

const DEVICE_LABELS: Record<Device, string> = {
  mobile: "Phone",
  tablet: "Tablet",
  desktop: "Computer",
  unknown: "Unknown",
};

function isDevice(value: string): value is Device {
  return value in DEVICE_LABELS;
}

const OUTBOUND_LABELS: [RegExp, string][] = [
  [/(^|\.)instagram\.com$/, "Instagram"],
  [/(^|\.)(google\.[a-z.]+|goo\.gl)$/, "Google Maps"],
  [/(^|\.)maps\.apple\.com$/, "Apple Maps"],
  [/(^|\.)twint\.ch$/, "TWINT"],
];

function outboundLabel(host: string) {
  return OUTBOUND_LABELS.find(([pattern]) => pattern.test(host))?.[1] ?? host;
}

function metric(
  current: StatRows["byKind"],
  previous: StatRows["byKind"],
  kind: string,
  field: keyof CountRow,
): Metric {
  return {
    value: current.find((row) => row.kind === kind)?.[field] ?? 0,
    previous: previous.find((row) => row.kind === kind)?.[field] ?? 0,
  };
}

/** Every day of the range, empty ones included; weeks for long ranges. */
function chartBuckets(
  rows: StatRows["byDay"],
  { from, to }: { from: string; to: string },
  days: StatPeriod,
): StatsReport["chart"] {
  const byDay = new Map(rows.map((row) => [row.day, row]));
  const unit = days > 90 ? "week" : "day";
  const width = unit === "week" ? 7 : 1;
  const buckets: ChartBucket[] = [];

  // weeks are counted back from today, so the last bar is always whole
  for (let end = to; end >= from; end = addDays(end, -width)) {
    const first = addDays(end, -(width - 1));
    const start = first < from ? from : first;
    let visitors = 0;
    let pageviews = 0;
    for (let day = start; day <= end; day = addDays(day, 1)) {
      visitors += byDay.get(day)?.visitors ?? 0;
      pageviews += byDay.get(day)?.hits ?? 0;
    }
    buckets.unshift({ start, end, visitors, pageviews });
  }

  return { unit, buckets };
}

/** Largest first; ties by name, so the order holds still between loads. */
function ranked<T extends { label: string }>(
  rows: T[],
  value: (row: T) => number,
) {
  return rows
    .filter((row) => value(row) > 0)
    .sort((a, b) => value(b) - value(a) || a.label.localeCompare(b.label));
}

function sortedShares<T extends { label: string; visitors: number }>(
  shares: T[],
) {
  return ranked(shares, (share) => share.visitors);
}

export function buildStatsReport(
  rows: StatRows,
  {
    days,
    today,
    now,
  }: {
    days: StatPeriod;
    today: string;
    now: Date;
  },
): StatsReport {
  const { current } = statRanges(days, today);
  const titles = new Map(rows.events.map((event) => [event.id, event.title]));

  const qrScans = (list: StatRows["entrySources"]) =>
    list.find((row) => row.source === "qr")?.hits ?? 0;

  const events = rows.events
    .map((event): EventStats => {
      const step = (kind: string) =>
        rows.funnels.find(
          (row) => row.eventId === event.id && row.kind === kind,
        )?.visitors ?? 0;

      const sources = new Map<string, SourceShare>();
      for (const row of rows.eventSources) {
        if (row.eventId !== event.id) continue;
        const { key, label } =
          row.source === "internal"
            ? internalSourceLabel(row.referrer, event.id)
            : { key: row.source, label: sourceLabel(row.source) };
        const share = sources.get(key) ?? { key, label, visitors: 0 };
        share.visitors += row.visitors;
        sources.set(key, share);
      }

      return {
        id: event.id,
        title: event.title,
        date: event.date.toISOString(),
        upcoming: event.date >= now,
        visitors: step("pageview"),
        started: step("signup_start"),
        submitted: step("signup_submit"),
        signedUp: step("signup"),
        sources: sortedShares([...sources.values()]),
      };
    })
    // an old event nobody looked at in this period says nothing
    .filter(
      (event) => event.upcoming || event.visitors > 0 || event.signedUp > 0,
    );

  return {
    period: { days, ...current },
    totals: {
      visitors: metric(
        rows.byKind,
        rows.previousByKind,
        "pageview",
        "visitors",
      ),
      pageviews: metric(rows.byKind, rows.previousByKind, "pageview", "hits"),
      signups: metric(rows.byKind, rows.previousByKind, "signup", "hits"),
      qrScans: {
        value: qrScans(rows.entrySources),
        previous: qrScans(rows.previousEntrySources),
      },
    },
    chart: chartBuckets(rows.byDay, current, days),
    events,
    sources: ranked(
      rows.entrySources.map((row) => ({
        key: row.source,
        label: sourceLabel(row.source),
        visitors: row.visitors,
        visits: row.hits,
      })),
      (source) => source.visits,
    ),
    pages: rows.byPath
      .map((row) => ({
        path: row.path,
        label: pageLabel(row.path, titles),
        visitors: row.visitors,
        pageviews: row.hits,
      }))
      .sort(
        (a, b) =>
          b.visitors - a.visitors ||
          b.pageviews - a.pageviews ||
          a.label.localeCompare(b.label),
      )
      .slice(0, 12),
    devices: sortedShares(
      rows.byDevice
        .filter((row) => isDevice(row.device))
        .map((row) => ({
          device: row.device as Device,
          label: DEVICE_LABELS[row.device as Device],
          visitors: row.visitors,
        })),
    ),
    outbound: rows.outbound
      .map((row) => ({
        host: row.detail,
        label: outboundLabel(row.detail),
        clicks: row.hits,
        visitors: row.visitors,
      }))
      .sort((a, b) => b.clicks - a.clicks || a.label.localeCompare(b.label)),
  };
}
