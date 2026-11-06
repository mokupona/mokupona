import { describe, expect, it } from "vitest";

import { formatCHF, formatRappen, summarizeRevenue } from "./revenue";

describe("summarizeRevenue", () => {
  it("counts confirmed parties as expected revenue and waiting-list parties as possible", () => {
    const summary = summarizeRevenue([
      { status: "confirmed", people: 2, total: 75 },
      { status: "confirmed", people: 1, total: 30 },
      { status: "waitlisted", people: 3, total: 120 },
    ]);

    expect(summary).toEqual({
      confirmedTotal: 105,
      confirmedPeople: 3,
      waitlistTotal: 120,
      waitlistPeople: 3,
      averagePerPerson: 35,
    });
  });

  it("leaves cancelled signups out of every figure", () => {
    const summary = summarizeRevenue([
      { status: "cancelled", people: 4, total: 180 },
      { status: "confirmed", people: 1, total: 45 },
    ]);

    expect(summary.confirmedTotal).toBe(45);
    expect(summary.waitlistTotal).toBe(0);
    expect(summary.confirmedPeople).toBe(1);
  });

  it("has no average before anyone holds a seat", () => {
    expect(summarizeRevenue([]).averagePerPerson).toBeNull();
    expect(
      summarizeRevenue([{ status: "waitlisted", people: 2, total: 90 }])
        .averagePerPerson,
    ).toBeNull();
  });

  it("rounds the average to the centime", () => {
    const summary = summarizeRevenue([
      { status: "confirmed", people: 3, total: 100 },
    ]);
    expect(summary.averagePerPerson).toBe(33.33);
  });
});

describe("formatCHF", () => {
  it("writes an amount in francs, with Rappen only when there are some", () => {
    expect(formatCHF(0)).toBe("0 CHF");
    expect(formatCHF(40)).toBe("40 CHF");
    expect(formatCHF(37.5)).toBe("37.50 CHF");
    expect(formatCHF(33.33)).toBe("33.33 CHF");
  });
});

describe("formatRappen", () => {
  it("writes an amount in Rappen as francs", () => {
    expect(formatRappen(4000)).toBe("40 CHF");
    expect(formatRappen(2250)).toBe("22.50 CHF");
    expect(formatRappen(-90)).toBe("-0.90 CHF");
  });
});
