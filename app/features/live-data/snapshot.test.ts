import { describe, expect, it } from "vitest";

import { liveDataFixture } from "../../../test/live-data-fixture";

import { liveDataTablesSchema } from "./snapshot";

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
