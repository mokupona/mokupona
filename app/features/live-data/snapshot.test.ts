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
      signupMailSubject: "See you at {event}",
      signupMailMessage: null,
    });
  });

  it("accepts events from a live site that predates those columns", () => {
    const tables = overTheWire(liveDataFixture());
    for (const event of tables.events) {
      delete event.studentPrice;
      delete event.signupMailSubject;
      delete event.signupMailMessage;
    }

    const parsed = liveDataTablesSchema.parse(tables);

    expect(parsed.events[0]).toMatchObject({
      studentPrice: null,
      signupMailSubject: null,
      signupMailMessage: null,
    });
  });
});
