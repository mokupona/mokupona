import { describe, expect, it } from "vitest";

import {
  decideSignupStatus,
  normalizeSignupEmail,
  partySize,
  seatsLeft,
  toSignupStatus,
} from "./signup-status";

describe("decideSignupStatus", () => {
  it.each([
    { slots: 30, confirmedSeats: 0, seats: 2, expected: "confirmed" },
    { slots: 30, confirmedSeats: 29, seats: 1, expected: "confirmed" },
    { slots: 30, confirmedSeats: 29, seats: 2, expected: "waitlisted" },
    { slots: 30, confirmedSeats: 30, seats: 1, expected: "waitlisted" },
    // overbooked by an admin: nobody else gets in
    { slots: 30, confirmedSeats: 32, seats: 1, expected: "waitlisted" },
    { slots: 3, confirmedSeats: 0, seats: 4, expected: "waitlisted" },
    { slots: 0, confirmedSeats: 0, seats: 1, expected: "waitlisted" },
  ] as const)(
    "$seats people with $confirmedSeats of $slots seats taken: $expected",
    ({ expected, ...input }) => {
      expect(decideSignupStatus(input)).toBe(expected);
    },
  );
});

describe("partySize", () => {
  it("counts the signer and each listed friend", () => {
    expect(partySize({})).toBe(1);
    expect(partySize({ friends: [] })).toBe(1);
    expect(partySize({ friends: [{}, {}] })).toBe(3);
    expect(partySize({ friends: "not a list" })).toBe(1);
  });
});

describe("helpers", () => {
  it("never reports negative seats left", () => {
    expect(seatsLeft(30, 12)).toBe(18);
    expect(seatsLeft(30, 32)).toBe(0);
  });

  it("reads unknown statuses as confirmed", () => {
    expect(toSignupStatus("waitlisted")).toBe("waitlisted");
    expect(toSignupStatus("pending")).toBe("confirmed");
    expect(toSignupStatus(undefined)).toBe("confirmed");
  });

  it("compares emails without case or surrounding spaces", () => {
    expect(normalizeSignupEmail("  Ada@Example.COM ")).toBe("ada@example.com");
  });
});
