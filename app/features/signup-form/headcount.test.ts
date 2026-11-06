import { describe, expect, it } from "vitest";

import { summarizeHeadcount } from "./headcount";

describe("summarizeHeadcount", () => {
  it("counts diet and student status per person, for confirmed and waiting-list groups", () => {
    const summary = summarizeHeadcount([
      {
        status: "confirmed",
        guests: [
          { isStudent: true, vegetarian: true },
          { isStudent: false, vegetarian: false },
        ],
      },
      {
        status: "confirmed",
        guests: [{ isStudent: false, vegetarian: true }],
      },
      {
        status: "waitlisted",
        guests: [
          { isStudent: true, vegetarian: false },
          { isStudent: false, vegetarian: false },
        ],
      },
    ]);

    expect(summary.confirmed).toEqual({
      people: 3,
      vegetarian: 2,
      notVegetarian: 1,
      dietNotAsked: 0,
      students: 1,
      notStudents: 2,
      arrived: 0,
    });
    expect(summary.waitlisted).toEqual({
      people: 2,
      vegetarian: 0,
      notVegetarian: 2,
      dietNotAsked: 0,
      students: 1,
      notStudents: 1,
      arrived: 0,
    });
  });

  it("keeps guests from a form without a diet question out of the diet counts", () => {
    const summary = summarizeHeadcount([
      {
        status: "confirmed",
        guests: [
          { isStudent: false, vegetarian: null },
          { isStudent: false, vegetarian: true },
        ],
      },
    ]);

    expect(summary.confirmed).toMatchObject({
      people: 2,
      vegetarian: 1,
      notVegetarian: 0,
      dietNotAsked: 1,
    });
  });

  it("counts the people ticked as arrived, per list", () => {
    const summary = summarizeHeadcount([
      {
        status: "confirmed",
        guests: [
          { isStudent: false, vegetarian: false, arrived: true },
          { isStudent: false, vegetarian: false, arrived: false },
          { isStudent: false, vegetarian: false },
        ],
      },
      {
        status: "waitlisted",
        guests: [{ isStudent: false, vegetarian: false, arrived: true }],
      },
      {
        status: "cancelled",
        guests: [{ isStudent: false, vegetarian: false, arrived: true }],
      },
    ]);

    expect(summary.confirmed.arrived).toBe(1);
    expect(summary.waitlisted.arrived).toBe(1);
  });

  it("leaves cancelled signups out", () => {
    const summary = summarizeHeadcount([
      { status: "cancelled", guests: [{ isStudent: true, vegetarian: true }] },
    ]);

    expect(summary.confirmed.people).toBe(0);
    expect(summary.waitlisted.people).toBe(0);
  });

  it("reads an empty event as nobody", () => {
    expect(summarizeHeadcount([]).confirmed.people).toBe(0);
  });
});
