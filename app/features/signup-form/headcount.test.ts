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
      guests: 3,
      helpers: 0,
      vegetarian: 2,
      notVegetarian: 1,
      dietNotAsked: 0,
      students: 1,
      notStudents: 2,
      arrived: 0,
      paysHalf: 0,
      paysNothing: 0,
    });
    expect(summary.waitlisted).toEqual({
      people: 2,
      guests: 2,
      helpers: 0,
      vegetarian: 0,
      notVegetarian: 2,
      dietNotAsked: 0,
      students: 1,
      notStudents: 1,
      arrived: 0,
      paysHalf: 0,
      paysNothing: 0,
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

  it("counts helpers apart from the guests, and with everyone who eats", () => {
    const summary = summarizeHeadcount([
      {
        status: "confirmed",
        guests: [
          { isStudent: false, vegetarian: true, helper: true },
          { isStudent: false, vegetarian: false, helper: false },
          { isStudent: false, vegetarian: false },
        ],
      },
      {
        status: "waitlisted",
        guests: [{ isStudent: false, vegetarian: false, helper: true }],
      },
    ]);

    expect(summary.confirmed).toMatchObject({
      people: 3,
      guests: 2,
      helpers: 1,
      vegetarian: 1,
      notVegetarian: 2,
    });
    expect(summary.waitlisted).toMatchObject({ guests: 0, helpers: 1 });
  });

  it("counts the people who pay half or nothing, per list", () => {
    const guest = { isStudent: false, vegetarian: false };
    const summary = summarizeHeadcount([
      {
        status: "confirmed",
        guests: [
          { ...guest, priceShare: "none" },
          { ...guest, priceShare: "none" },
          { ...guest, priceShare: "half" },
          { ...guest, priceShare: "full" },
          guest,
        ],
      },
      { status: "waitlisted", guests: [{ ...guest, priceShare: "half" }] },
      { status: "cancelled", guests: [{ ...guest, priceShare: "none" }] },
    ]);

    expect(summary.confirmed).toMatchObject({
      people: 5,
      paysHalf: 1,
      paysNothing: 2,
    });
    expect(summary.waitlisted).toMatchObject({ paysHalf: 1, paysNothing: 0 });
  });

  it("leaves out anyone cancelled on their own, the rest of the group counting", () => {
    const summary = summarizeHeadcount([
      {
        status: "confirmed",
        guests: [
          { isStudent: false, vegetarian: true, cancelled: true },
          { isStudent: true, vegetarian: false, arrived: true },
          {
            isStudent: false,
            vegetarian: false,
            helper: true,
            cancelled: true,
          },
        ],
      },
    ]);

    expect(summary.confirmed).toMatchObject({
      people: 1,
      guests: 1,
      helpers: 0,
      vegetarian: 0,
      notVegetarian: 1,
      students: 1,
      arrived: 1,
    });
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
