import { describe, expect, it } from "vitest";

import { liveDataFixture } from "../../../test/live-data-fixture";

import {
  countLiveDataRows,
  LIVE_DATA_FORMAT,
  LIVE_DATA_FORMAT_VERSION,
  liveDataSummarySchema,
  liveDataTablesSchema,
} from "./snapshot";

// what JSON.parse hands the importer: dates as ISO strings
function overTheWire(value: unknown) {
  return JSON.parse(JSON.stringify(value));
}

describe("liveDataTablesSchema", () => {
  it("reads the event's student price and signup mail copy", () => {
    const parsed = liveDataTablesSchema.parse(overTheWire(liveDataFixture()));

    expect(parsed.events[0]).toMatchObject({
      studentPrice: 20,
      confirmedMailSubject: "See you at {event}",
      confirmedMailMessage: null,
    });
  });

  it("accepts events from a live site that predates those columns", () => {
    const tables = overTheWire(liveDataFixture());
    for (const event of tables.events) {
      delete event.studentPrice;
      delete event.confirmedMailSubject;
      delete event.confirmedMailMessage;
      delete event.waitlistMailSubject;
      delete event.waitlistMailMessage;
    }

    const parsed = liveDataTablesSchema.parse(tables);

    expect(parsed.events[0]).toMatchObject({
      studentPrice: null,
      confirmedMailSubject: null,
      confirmedMailMessage: null,
      waitlistMailSubject: null,
      waitlistMailMessage: null,
    });
  });
});

describe("liveDataTablesSchema signups", () => {
  it("keeps each signup's status, seats and email", () => {
    const parsed = liveDataTablesSchema.parse(overTheWire(liveDataFixture()));

    expect(parsed.formSubmissions[0]).toMatchObject({
      status: "waitlisted",
      seats: 1,
      email: "ada@example.com",
    });
  });

  it("reads signups from a live site that predates them as confirmed, sized from the answers", () => {
    const tables = overTheWire(liveDataFixture());
    tables.formSubmissions[0] = {
      id: "old_submission",
      formVersionId: tables.formSubmissions[0].formVersionId,
      answers: {
        name: "Ada",
        email: " Ada@Example.com ",
        friends: [{ name: "Grace" }, { name: "Alan" }],
      },
      createdAt: tables.formSubmissions[0].createdAt,
    };

    const parsed = liveDataTablesSchema.parse(tables);

    expect(parsed.formSubmissions[0]).toMatchObject({
      status: "confirmed",
      seats: 3,
      email: "ada@example.com",
    });
  });
});

describe("liveDataTablesSchema site texts", () => {
  it("carries the live site's edited texts", () => {
    const parsed = liveDataTablesSchema.parse(overTheWire(liveDataFixture()));

    expect(parsed.siteTexts).toEqual([
      {
        key: "landing.vision.headline",
        value: "live: food is how we meet",
        defaultAtEdit: "food as a way to connect",
        createdAt: new Date("2025-01-10T10:00:00.000Z"),
        updatedAt: new Date("2025-01-10T10:00:00.000Z"),
      },
    ]);
  });

  it("reads a live site that predates edited texts as having none", () => {
    const tables = overTheWire(liveDataFixture());
    delete tables.siteTexts;

    expect(liveDataTablesSchema.parse(tables).siteTexts).toEqual([]);
  });
});

describe("liveDataSummarySchema", () => {
  it("counts no edited texts on a live site that predates them", () => {
    const { siteTexts: _siteTexts, ...olderCounts } =
      countLiveDataRows(liveDataFixture());

    const summary = liveDataSummarySchema.parse({
      format: LIVE_DATA_FORMAT,
      formatVersion: LIVE_DATA_FORMAT_VERSION,
      exportedAt: "2025-01-10T10:00:00.000Z",
      includesSignups: false,
      source: {
        schemaVersion: null,
        imageProvider: "local",
        cloudinaryCloudName: null,
      },
      counts: olderCounts,
    });

    expect(summary.counts.siteTexts).toBe(0);
    expect(summary.counts.events).toBe(1);
  });
});

describe("liveDataTablesSchema payment bookkeeping", () => {
  it("carries each signup's payment ticks and note", () => {
    const parsed = liveDataTablesSchema.parse(overTheWire(liveDataFixture()));

    expect(parsed.formSubmissions[0]).toMatchObject({
      firstHalfPaid: true,
      secondHalfPaid: false,
      adminNote: "Pays the second half by transfer in December",
    });
  });

  it("reads a live site that predates the ticks as unpaid, with no note", () => {
    const tables = overTheWire(liveDataFixture());
    for (const submission of tables.formSubmissions) {
      delete submission.firstHalfPaid;
      delete submission.secondHalfPaid;
      delete submission.adminNote;
    }

    expect(liveDataTablesSchema.parse(tables).formSubmissions[0]).toMatchObject(
      {
        firstHalfPaid: false,
        secondHalfPaid: false,
        adminNote: "",
      },
    );
  });
});
