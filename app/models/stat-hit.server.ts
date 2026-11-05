import type { Prisma } from "#prisma/generated/client";

import { prisma } from "~/db.server";

export function createStatHit(data: Prisma.StatHitCreateInput) {
  return prisma.statHit.create({ data, select: { id: true } });
}

/** Whether a page view's event exists, so made-up ids aren't counted. */
export async function statEventExists(eventId: string) {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { id: true },
  });
  return event !== null;
}

/** Inclusive range of Zürich calendar days, "2026-10-07" to "2026-11-05". */
export interface DayRange {
  from: string;
  to: string;
}

// SQLite hands COUNT back as a bigint through the driver adapter
type Counted<Row> = Row & { hits: bigint | number; visitors: bigint | number };

function counts<Row>(rows: Counted<Row>[]) {
  return rows.map((row) => ({
    ...row,
    hits: Number(row.hits),
    visitors: Number(row.visitors),
  }));
}

/**
 * Visitors are distinct visitor codes. A code only lives for a day, so over
 * a range this is the sum of each day's visitors: someone who comes back on
 * another day counts again.
 */
export async function countHitsByKind({ from, to }: DayRange) {
  return counts(
    await prisma.$queryRaw<Counted<{ kind: string }>[]>`
      SELECT "kind", COUNT(*) AS "hits", COUNT(DISTINCT "visitor") AS "visitors"
      FROM "StatHit"
      WHERE "day" BETWEEN ${from} AND ${to}
      GROUP BY "kind"`,
  );
}

/** Page views and visitors per day; days without any are left out. */
export async function countPageviewsByDay({ from, to }: DayRange) {
  return counts(
    await prisma.$queryRaw<Counted<{ day: string }>[]>`
      SELECT "day", COUNT(*) AS "hits", COUNT(DISTINCT "visitor") AS "visitors"
      FROM "StatHit"
      WHERE "kind" = 'pageview' AND "day" BETWEEN ${from} AND ${to}
      GROUP BY "day"`,
  );
}

/**
 * Each event's funnel: its page's visitors, then the signup steps. Views of
 * the event's album are not part of it.
 */
export async function countEventFunnels({ from, to }: DayRange) {
  return counts(
    await prisma.$queryRaw<Counted<{ eventId: string; kind: string }>[]>`
      SELECT "eventId", "kind", COUNT(*) AS "hits", COUNT(DISTINCT "visitor") AS "visitors"
      FROM "StatHit"
      WHERE "eventId" IS NOT NULL
        AND "day" BETWEEN ${from} AND ${to}
        AND ("kind" <> 'pageview' OR "path" NOT LIKE '%/gallery')
      GROUP BY "eventId", "kind"`,
  );
}

/**
 * How visitors reached each event's page: the source, and for a step from
 * another page of the site, which page that was.
 */
export async function countEventSources({ from, to }: DayRange) {
  return counts(
    await prisma.$queryRaw<
      Counted<{ eventId: string; source: string; referrer: string | null }>[]
    >`
      SELECT "eventId", "source",
        CASE WHEN "source" = 'internal' THEN "referrer" END AS "referrer",
        COUNT(*) AS "hits", COUNT(DISTINCT "visitor") AS "visitors"
      FROM "StatHit"
      WHERE "kind" = 'pageview' AND "eventId" IS NOT NULL
        AND "path" NOT LIKE '%/gallery'
        AND "day" BETWEEN ${from} AND ${to}
      GROUP BY 1, 2, 3`,
  );
}

/**
 * Where visits start: page views that didn't come from another page here.
 * `hits` is the number of visits that began that way.
 */
export async function countEntrySources({ from, to }: DayRange) {
  return counts(
    await prisma.$queryRaw<Counted<{ source: string }>[]>`
      SELECT "source", COUNT(*) AS "hits", COUNT(DISTINCT "visitor") AS "visitors"
      FROM "StatHit"
      WHERE "kind" = 'pageview' AND "source" <> 'internal'
        AND "day" BETWEEN ${from} AND ${to}
      GROUP BY "source"`,
  );
}

export async function countPageviewsByPath({ from, to }: DayRange) {
  return counts(
    await prisma.$queryRaw<Counted<{ path: string; eventId: string | null }>[]>`
      SELECT "path", "eventId", COUNT(*) AS "hits", COUNT(DISTINCT "visitor") AS "visitors"
      FROM "StatHit"
      WHERE "kind" = 'pageview' AND "day" BETWEEN ${from} AND ${to}
      GROUP BY "path", "eventId"`,
  );
}

export async function countVisitorsByDevice({ from, to }: DayRange) {
  return counts(
    await prisma.$queryRaw<Counted<{ device: string }>[]>`
      SELECT "device", COUNT(*) AS "hits", COUNT(DISTINCT "visitor") AS "visitors"
      FROM "StatHit"
      WHERE "kind" = 'pageview' AND "day" BETWEEN ${from} AND ${to}
      GROUP BY "device"`,
  );
}

export async function countOutboundClicks({ from, to }: DayRange) {
  return counts(
    await prisma.$queryRaw<Counted<{ detail: string }>[]>`
      SELECT "detail", COUNT(*) AS "hits", COUNT(DISTINCT "visitor") AS "visitors"
      FROM "StatHit"
      WHERE "kind" = 'outbound' AND "detail" IS NOT NULL
        AND "day" BETWEEN ${from} AND ${to}
      GROUP BY "detail"`,
  );
}

/**
 * The events the report names: those with hits in the range, plus every
 * upcoming one, so a fresh event shows up before anyone has looked at it.
 */
export function getStatEvents(ids: string[], now: Date) {
  return prisma.event.findMany({
    where: { OR: [{ id: { in: ids } }, { date: { gte: now } }] },
    select: { id: true, title: true, date: true },
    orderBy: { date: "desc" },
  });
}
