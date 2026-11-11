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
  it("reads the event's discounts, visibility and signup mail copy", () => {
    const parsed = liveDataTablesSchema.parse(overTheWire(liveDataFixture()));

    expect(parsed.events[0]).toMatchObject({
      published: true,
      studentDiscount: 10,
      vegetarianDiscount: 5,
      confirmedMailSubject: "See you at {event}",
      confirmedMailMessage: null,
    });
  });

  it("accepts events from a live site that predates those columns", () => {
    const tables = overTheWire(liveDataFixture());
    for (const event of tables.events) {
      delete event.published;
      delete event.studentDiscount;
      delete event.vegetarianDiscount;
      delete event.confirmedMailSubject;
      delete event.confirmedMailMessage;
      delete event.waitlistMailSubject;
      delete event.waitlistMailMessage;
    }

    const parsed = liveDataTablesSchema.parse(tables);

    expect(parsed.events[0]).toMatchObject({
      published: true,
      studentDiscount: null,
      vegetarianDiscount: null,
      confirmedMailSubject: null,
      confirmedMailMessage: null,
      waitlistMailSubject: null,
      waitlistMailMessage: null,
    });
  });
});

describe("liveDataTablesSchema events from before the discounts", () => {
  it("turns an old student price into the same student discount", () => {
    const tables = overTheWire(liveDataFixture());
    const [event] = tables.events;
    delete event.studentDiscount;
    delete event.vegetarianDiscount;
    event.price = 45;
    event.studentPrice = 30;

    const parsed = liveDataTablesSchema.parse(tables);

    expect(parsed.events[0]).toMatchObject({
      studentDiscount: 15,
      vegetarianDiscount: null,
    });
    expect(parsed.events[0]).not.toHaveProperty("studentPrice");
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

  it("carries how the halves came in, the mails ticked by hand, and each person's arrival and donation", () => {
    const parsed = liveDataTablesSchema.parse(overTheWire(liveDataFixture()));

    expect(parsed.formSubmissions[0]).toMatchObject({
      firstHalfMethod: "cash",
      secondHalfMethod: "twint",
      confirmationMarkedSent: true,
      paymentReminderSent: true,
    });
    expect(parsed.signupGuests).toEqual([
      expect.objectContaining({
        guestIndex: 0,
        arrivedAt: new Date("2025-02-01T18:05:00.000Z"),
        donationRappen: 750,
        donationMethod: "cash",
      }),
    ]);
    expect(parsed.events[0]).toMatchObject({
      twintFeePercent: 1.3,
      twintFeeFixedRappen: 25,
    });
  });

  it("carries a party that pays in one payment", () => {
    const tables = overTheWire(liveDataFixture());
    tables.formSubmissions[0].singlePayment = true;

    const parsed = liveDataTablesSchema.parse(tables);

    expect(parsed.formSubmissions[0]).toMatchObject({ singlePayment: true });
  });

  it("reads a live site that predates single payments as paying in halves", () => {
    const tables = overTheWire(liveDataFixture());
    for (const submission of tables.formSubmissions) {
      delete submission.singlePayment;
    }

    const parsed = liveDataTablesSchema.parse(tables);

    expect(parsed.formSubmissions[0]).toMatchObject({ singlePayment: false });
  });

  it("reads a live site that predates recaps as events without one", () => {
    const tables = overTheWire(liveDataFixture());
    for (const event of tables.events) delete event.recap;

    const parsed = liveDataTablesSchema.parse(tables);

    expect(parsed.events[0]).toMatchObject({ recap: null });
  });

  it("carries the recap across", () => {
    const parsed = liveDataTablesSchema.parse(overTheWire(liveDataFixture()));

    expect(parsed.events[0]).toMatchObject({
      recap: "Thank you for a warm evening.",
    });
  });

  it("reads a live site that predates the payment methods with the defaults and no arrivals", () => {
    const tables = overTheWire(liveDataFixture());
    for (const submission of tables.formSubmissions) {
      delete submission.firstHalfMethod;
      delete submission.secondHalfMethod;
      delete submission.confirmationMarkedSent;
      delete submission.paymentReminderSent;
    }
    for (const event of tables.events) {
      delete event.twintFeePercent;
      delete event.twintFeeFixedRappen;
    }
    delete tables.signupGuests;

    const parsed = liveDataTablesSchema.parse(tables);

    expect(parsed.formSubmissions[0]).toMatchObject({
      firstHalfMethod: "twint",
      secondHalfMethod: "twint",
      confirmationMarkedSent: null,
      paymentReminderSent: false,
    });
    expect(parsed.events[0]).toMatchObject({
      twintFeePercent: 1.5,
      twintFeeFixedRappen: 30,
    });
    expect(parsed.signupGuests).toEqual([]);
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
