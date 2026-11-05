// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { buildEventData } from "../../../test/factories";

import { addDays, statsDay } from "./hit";
import { loadStatsReport } from "./report.server";

import { prisma } from "~/db.server";
import { createEvent, deleteEventsInTx } from "~/models/event.server";

const now = new Date("2026-11-05T12:00:00Z");
const today = statsDay(now);
const eventIds: string[] = [];

// other files' hits (a signup's) must not leak into these counts
beforeEach(async () => {
  await prisma.statHit.deleteMany();
});

afterEach(async () => {
  await prisma.statHit.deleteMany();
  const events = eventIds.splice(0);
  if (events.length > 0) {
    await prisma.$transaction((tx) =>
      deleteEventsInTx(tx, { id: { in: events } }),
    );
  }
});

async function makeEvent(title: string, date: Date) {
  const event = await createEvent({
    ...(await buildEventData()),
    title,
    date,
  });
  eventIds.push(event.id);
  return event.id;
}

type Hit = {
  visitor: string;
  kind?: string;
  path?: string;
  eventId?: string | null;
  source?: string;
  referrer?: string | null;
  device?: string;
  detail?: string | null;
  daysAgo?: number;
};

function hits(...rows: Hit[]) {
  return prisma.statHit.createMany({
    data: rows.map(({ daysAgo = 0, ...row }) => ({
      kind: "pageview",
      path: "/",
      eventId: null,
      source: "direct",
      referrer: null,
      device: "desktop",
      detail: null,
      ...row,
      day: addDays(today, -daysAgo),
    })),
  });
}

describe("loadStatsReport", () => {
  it("adds up visitors, page views, signups and scans against the period before", async () => {
    const eventId = await makeEvent(
      "Autumn dinner",
      new Date("2026-11-20T18:00:00Z"),
    );
    const page = `/events/${eventId}`;

    await hits(
      // today: two visitors, one by QR, three page views, one signup
      { visitor: "a", path: page, eventId, source: "qr" },
      { visitor: "a", path: "/about", source: "internal", referrer: page },
      {
        visitor: "b",
        path: "/",
        source: "instagram",
        referrer: "l.instagram.com",
      },
      {
        visitor: "a",
        kind: "signup",
        path: page,
        eventId,
        source: "internal",
        detail: "confirmed",
      },
      // 40 days ago: the previous 30-day period
      { visitor: "c", daysAgo: 40 },
    );

    const report = await loadStatsReport(30, now);

    expect(report.period).toEqual({
      days: 30,
      from: addDays(today, -29),
      to: today,
    });
    expect(report.totals).toEqual({
      visitors: { value: 2, previous: 1 },
      pageviews: { value: 3, previous: 1 },
      signups: { value: 1, previous: 0 },
      qrScans: { value: 1, previous: 0 },
    });
    expect(report.chart.unit).toBe("day");
    expect(report.chart.buckets).toHaveLength(30);
    expect(report.chart.buckets.at(-1)).toEqual({
      start: today,
      end: today,
      visitors: 2,
      pageviews: 3,
    });
  });

  it("follows each event from its page to a seat", async () => {
    const eventId = await makeEvent(
      "Winter dinner",
      new Date("2026-12-01T18:00:00Z"),
    );
    const page = `/events/${eventId}`;
    await hits(
      { visitor: "a", path: page, eventId, source: "qr" },
      { visitor: "b", path: page, eventId, source: "internal", referrer: "/" },
      {
        visitor: "c",
        path: page,
        eventId,
        source: "internal",
        referrer: "/events",
      },
      { visitor: "d", path: page, eventId, source: "direct" },
      // the album doesn't count towards the event page's visitors
      { visitor: "e", path: `${page}/gallery`, eventId, source: "direct" },
      {
        visitor: "a",
        kind: "signup_start",
        path: page,
        eventId,
        source: "internal",
      },
      {
        visitor: "b",
        kind: "signup_start",
        path: page,
        eventId,
        source: "internal",
      },
      {
        visitor: "a",
        kind: "signup_submit",
        path: page,
        eventId,
        source: "internal",
      },
      {
        visitor: "a",
        kind: "signup_submit",
        path: page,
        eventId,
        source: "internal",
      },
      { visitor: "a", kind: "signup", path: page, eventId, source: "internal" },
    );

    const report = await loadStatsReport(7, now);
    const event = report.events.find((e) => e.id === eventId);

    expect(event).toMatchObject({
      title: "Winter dinner",
      upcoming: true,
      visitors: 4,
      started: 2,
      submitted: 1,
      signedUp: 1,
    });
    expect(event?.sources.map((s) => [s.label, s.visitors])).toEqual(
      expect.arrayContaining([
        ["QR code", 1],
        ["Landing page", 1],
        ["Events list", 1],
        ["Direct or an app", 1],
      ]),
    );
    expect(report.pages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: "Event: Winter dinner", visitors: 4 }),
        expect.objectContaining({ label: "Album: Winter dinner", visitors: 1 }),
      ]),
    );
  });

  it("lists an upcoming event before anyone has seen it, and leaves quiet old ones out", async () => {
    const upcoming = await makeEvent(
      "Next dinner",
      new Date("2026-12-24T18:00:00Z"),
    );
    const old = await makeEvent("Old dinner", new Date("2026-01-10T18:00:00Z"));
    await hits({
      visitor: "a",
      path: `/events/${old}`,
      eventId: old,
      daysAgo: 100,
    });

    const report = await loadStatsReport(30, now);
    const ids = report.events.map((event) => event.id);

    expect(ids).toContain(upcoming);
    expect(ids).not.toContain(old);
  });

  it("breaks visits down by source, device and outbound link", async () => {
    await hits(
      { visitor: "a", source: "instagram", device: "mobile" },
      { visitor: "a", path: "/about", source: "internal", device: "mobile" },
      { visitor: "b", source: "flyer", device: "desktop" },
      {
        visitor: "a",
        kind: "outbound",
        source: "internal",
        detail: "instagram.com",
      },
      {
        visitor: "b",
        kind: "outbound",
        source: "internal",
        detail: "instagram.com",
      },
    );

    const report = await loadStatsReport(7, now);

    expect(report.sources).toEqual([
      expect.objectContaining({ label: "Instagram", visits: 1 }),
      expect.objectContaining({ label: "Link tagged “flyer”", visits: 1 }),
    ]);
    expect(report.devices.map((d) => [d.label, d.visitors])).toEqual(
      expect.arrayContaining([
        ["Phone", 1],
        ["Computer", 1],
      ]),
    );
    expect(report.outbound).toEqual([
      { host: "instagram.com", label: "Instagram", clicks: 2, visitors: 2 },
    ]);
  });

  it("groups a year into weeks that end today", async () => {
    await hits(
      { visitor: "a" },
      { visitor: "b", daysAgo: 6 },
      { visitor: "c", daysAgo: 7 },
    );

    const { chart } = await loadStatsReport(365, now);

    expect(chart.unit).toBe("week");
    expect(chart.buckets.at(-1)).toEqual({
      start: addDays(today, -6),
      end: today,
      visitors: 2,
      pageviews: 2,
    });
    expect(chart.buckets.at(-2)?.visitors).toBe(1);
    // the oldest bucket is cut off at the start of the period
    expect(chart.buckets[0].start).toBe(addDays(today, -364));
  });
});
