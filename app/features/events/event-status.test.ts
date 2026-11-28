import { describe, expect, it } from "vitest";

import {
  isAfterEventDay,
  orderEventsByStatus,
  partitionEvents,
} from "./event-status";

const now = new Date("2026-07-12T12:00:00.000Z");

describe("event status ordering", () => {
  it("orders upcoming soonest-first and past newest-first", () => {
    const events = [
      { id: "past-older", date: "2026-07-10T12:00:00.000Z" },
      { id: "future-later", date: "2026-07-14T12:00:00.000Z" },
      { id: "past-newer", date: "2026-07-11T12:00:00.000Z" },
      { id: "boundary", date: now.toISOString() },
      { id: "future-sooner", date: "2026-07-13T12:00:00.000Z" },
    ];

    expect(orderEventsByStatus(events, now).map(({ id }) => id)).toEqual([
      "boundary",
      "future-sooner",
      "future-later",
      "past-newer",
      "past-older",
    ]);
    expect(events.map(({ id }) => id)).toEqual([
      "past-older",
      "future-later",
      "past-newer",
      "boundary",
      "future-sooner",
    ]);
  });

  it("treats an event exactly on now as upcoming", () => {
    const { upcoming, past } = partitionEvents(
      [
        { id: "past", date: new Date(now.getTime() - 1) },
        { id: "boundary", date: now },
      ],
      now,
    );

    expect(upcoming.map(({ id }) => id)).toEqual(["boundary"]);
    expect(past.map(({ id }) => id)).toEqual(["past"]);
  });

  it("preserves input order for equal dates", () => {
    const date = "2026-07-13T12:00:00.000Z";
    const events = [
      { id: "first", date },
      { id: "second", date },
    ];

    expect(orderEventsByStatus(events, now).map(({ id }) => id)).toEqual([
      "first",
      "second",
    ]);
  });
});

describe("the end of an event's day", () => {
  // 19:00 in Zürich (UTC+1 in winter)
  const event = new Date("2026-11-28T18:00:00.000Z");

  it("hasn't come before the event starts, nor later that evening", () => {
    expect(isAfterEventDay(event, new Date("2026-11-28T08:00:00.000Z"))).toBe(
      false,
    );
    // 23:59 in Zürich, long after the start
    expect(isAfterEventDay(event, new Date("2026-11-28T22:59:00.000Z"))).toBe(
      false,
    );
  });

  it("comes at midnight in Zürich, not in UTC", () => {
    // 00:01 the next day in Zürich, still the 28th in UTC
    expect(isAfterEventDay(event, new Date("2026-11-28T23:01:00.000Z"))).toBe(
      true,
    );
  });

  it("reads the event's own day in Zürich too", () => {
    // 00:30 on the 29th in Zürich, still the 28th in UTC
    const lateEvent = new Date("2026-11-28T23:30:00.000Z");

    expect(
      isAfterEventDay(lateEvent, new Date("2026-11-29T22:00:00.000Z")),
    ).toBe(false);
    expect(
      isAfterEventDay(lateEvent, new Date("2026-11-29T23:00:00.000Z")),
    ).toBe(true);
  });

  it("follows summer time", () => {
    // 19:00 in Zürich (UTC+2 in summer)
    const summerEvent = new Date("2026-07-12T17:00:00.000Z");

    expect(
      isAfterEventDay(summerEvent, new Date("2026-07-12T21:59:00.000Z")),
    ).toBe(false);
    expect(
      isAfterEventDay(summerEvent, new Date("2026-07-12T22:00:00.000Z")),
    ).toBe(true);
  });
});
