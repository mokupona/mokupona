import { describe, expect, it } from "vitest";

import {
  fillSignupMailPlaceholders,
  unknownSignupMailPlaceholders,
  type SignupMailValues,
} from "./confirmation-mail";

const values: SignupMailValues = {
  name: "Ada",
  event: "Winter table",
  date: "Saturday 14 November, 19:00",
  guests: "2",
  total: "90 CHF",
};

describe("fillSignupMailPlaceholders", () => {
  it("replaces every known placeholder, as often as it appears", () => {
    expect(
      fillSignupMailPlaceholders(
        "{name}, see you at {event} on {date}. {guests} people, {total}. Bye {name}!",
        values,
      ),
    ).toBe(
      "Ada, see you at Winter table on Saturday 14 November, 19:00. 2 people, 90 CHF. Bye Ada!",
    );
  });

  it("leaves anything else in braces alone", () => {
    expect(fillSignupMailPlaceholders("{nmae} {toString} {}", values)).toBe(
      "{nmae} {toString} {}",
    );
  });
});

describe("unknownSignupMailPlaceholders", () => {
  it("reports typos once each, and nothing for known placeholders", () => {
    expect(
      unknownSignupMailPlaceholders("{name} {nmae} {nmae} {constructor}"),
    ).toEqual(["{nmae}", "{constructor}"]);
    expect(unknownSignupMailPlaceholders("Hi {name}, {total}")).toEqual([]);
  });
});
