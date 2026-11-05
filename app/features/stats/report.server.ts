import { statsDay } from "./hit";
import { buildStatsReport, statRanges, type StatPeriod } from "./report";

import {
  countEntrySources,
  countEventFunnels,
  countEventSources,
  countHitsByKind,
  countOutboundClicks,
  countPageviewsByDay,
  countPageviewsByPath,
  countVisitorsByDevice,
  getStatEvents,
} from "~/models/stat-hit.server";

/** Everything the statistics page shows, for the `days` up to today. */
export async function loadStatsReport(days: StatPeriod, now = new Date()) {
  const today = statsDay(now);
  const { current, previous } = statRanges(days, today);

  const [
    byKind,
    previousByKind,
    byDay,
    funnels,
    eventSources,
    entrySources,
    previousEntrySources,
    byPath,
    byDevice,
    outbound,
  ] = await Promise.all([
    countHitsByKind(current),
    countHitsByKind(previous),
    countPageviewsByDay(current),
    countEventFunnels(current),
    countEventSources(current),
    countEntrySources(current),
    countEntrySources(previous),
    countPageviewsByPath(current),
    countVisitorsByDevice(current),
    countOutboundClicks(current),
  ]);

  const eventIds = new Set([
    ...funnels.map((row) => row.eventId),
    ...byPath.flatMap((row) => (row.eventId ? [row.eventId] : [])),
  ]);
  const events = await getStatEvents([...eventIds], now);

  return buildStatsReport(
    {
      byKind,
      previousByKind,
      byDay,
      funnels,
      eventSources,
      entrySources,
      previousEntrySources,
      byPath,
      byDevice,
      outbound,
      events,
    },
    { days, today, now },
  );
}
