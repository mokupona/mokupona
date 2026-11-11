import { describe, expect, it } from "vitest";

import {
  halfPrice,
  parseChfInput,
  parsePercentInput,
  rappenToInput,
  summarizeMoneyReceived,
  toPaymentMethod,
  twintFee,
  type PaymentParty,
} from "./payments";

const FEES = { percent: 1.5, fixedRappen: 30 };

function party(overrides: Partial<PaymentParty> = {}): PaymentParty {
  return {
    status: "confirmed",
    total: 80,
    singlePayment: false,
    firstHalf: { paid: false, method: "twint" },
    secondHalf: { paid: false, method: "twint" },
    donations: [],
    ...overrides,
  };
}

describe("twintFee", () => {
  it("keeps the share and the fixed sum, rounded to the Rappen", () => {
    // 1.5% of 40 CHF is 60 Rappen, plus 30
    expect(twintFee(4000, FEES)).toBe(90);
    // 1.5% of 22.50 CHF is 33.75 Rappen
    expect(twintFee(2250, FEES)).toBe(64);
    expect(twintFee(4000, { percent: 0, fixedRappen: 0 })).toBe(0);
  });

  it("keeps nothing of a payment of nothing", () => {
    expect(twintFee(0, FEES)).toBe(0);
  });
});

describe("halfPrice", () => {
  it("halves a price in francs, in Rappen", () => {
    expect(halfPrice(80)).toBe(4000);
    expect(halfPrice(45)).toBe(2250);
    expect(halfPrice(0)).toBe(0);
  });
});

describe("parseChfInput", () => {
  it("reads francs with a point or a comma", () => {
    expect(parseChfInput("10")).toBe(1000);
    expect(parseChfInput(" 7.5 ")).toBe(750);
    expect(parseChfInput("7,50")).toBe(750);
    expect(parseChfInput("0.29")).toBe(29);
    expect(parseChfInput("12 CHF")).toBe(1200);
  });

  it("reads an empty field as nothing entered", () => {
    expect(parseChfInput("")).toBeNull();
    expect(parseChfInput("   ")).toBeNull();
  });

  it("refuses what isn't an amount", () => {
    expect(parseChfInput("-5")).toBeUndefined();
    expect(parseChfInput("ten")).toBeUndefined();
    expect(parseChfInput("1.234")).toBeUndefined();
    expect(parseChfInput("1e3")).toBeUndefined();
  });

  it("shows a stored amount the way it reads it", () => {
    expect(rappenToInput(1000)).toBe("10");
    expect(rappenToInput(750)).toBe("7.50");
    expect(rappenToInput(null)).toBe("");
    expect(parseChfInput(rappenToInput(750))).toBe(750);
  });
});

describe("parsePercentInput", () => {
  it("reads a share with a point, a comma or a percent sign", () => {
    expect(parsePercentInput("1.5")).toBe(1.5);
    expect(parsePercentInput("1,3 %")).toBe(1.3);
    expect(parsePercentInput("0")).toBe(0);
    expect(parsePercentInput("")).toBeNull();
    expect(parsePercentInput("1.255")).toBeUndefined();
  });
});

describe("toPaymentMethod", () => {
  it("reads a stored method, and anything unknown as TWINT", () => {
    expect(toPaymentMethod("cash")).toBe("cash");
    expect(toPaymentMethod("twint")).toBe("twint");
    expect(toPaymentMethod("cheque")).toBe("twint");
  });
});

describe("summarizeMoneyReceived", () => {
  it("adds up the ticked halves and the donations, by how they came in", () => {
    const money = summarizeMoneyReceived(
      [
        party({
          firstHalf: { paid: true, method: "twint" },
          secondHalf: { paid: true, method: "cash" },
          donations: [
            { amount: 1000, method: "cash" },
            { amount: null, method: "twint" },
          ],
        }),
        party({
          total: 45,
          firstHalf: { paid: true, method: "twint" },
          donations: [{ amount: 500, method: "twint" }],
        }),
      ],
      FEES,
    );

    expect(money.payments).toEqual({ twint: 4000 + 2250, cash: 4000 });
    expect(money.donations).toEqual({ twint: 500, cash: 1000 });
    expect(money.gross).toBe(11750);
    // one fee per TWINT payment: 90 on 40 CHF, 64 on 22.50, 38 on 5
    expect(money.twintTransactions).toBe(3);
    expect(money.twintFees).toBe(90 + 64 + 38);
    expect(money.net).toBe(11750 - 192);
  });

  it("charges nothing for cash", () => {
    const money = summarizeMoneyReceived(
      [
        party({
          firstHalf: { paid: true, method: "cash" },
          secondHalf: { paid: true, method: "cash" },
          donations: [{ amount: 2000, method: "cash" }],
        }),
      ],
      FEES,
    );

    expect(money.twintFees).toBe(0);
    expect(money.twintTransactions).toBe(0);
    expect(money.net).toBe(money.gross);
    expect(money.gross).toBe(10000);
  });

  it("counts what confirmed parties still owe, and nobody else's", () => {
    const money = summarizeMoneyReceived(
      [
        party({ firstHalf: { paid: true, method: "twint" } }),
        party({ total: 40 }),
        party({
          firstHalf: { paid: true, method: "twint" },
          secondHalf: { paid: true, method: "twint" },
        }),
        party({ status: "waitlisted" }),
        party({ status: "cancelled" }),
      ],
      FEES,
    );

    expect(money.outstanding).toBe(4000 + 4000);
    expect(money.outstandingParties).toBe(2);
  });

  it("takes a price paid in one payment whole, with one TWINT fee", () => {
    const money = summarizeMoneyReceived(
      [
        party({
          singlePayment: true,
          firstHalf: { paid: true, method: "twint" },
          // left from before it paid in one: doesn't count
          secondHalf: { paid: true, method: "cash" },
        }),
      ],
      FEES,
    );

    expect(money.payments).toEqual({ twint: 8000, cash: 0 });
    // 1.5% of 80 CHF is 120 Rappen, plus 30 once
    expect(money.twintTransactions).toBe(1);
    expect(money.twintFees).toBe(150);
    expect(money.net).toBe(8000 - 150);
    expect(money.outstanding).toBe(0);
  });

  it("counts the whole price as owed until one payment is ticked", () => {
    const money = summarizeMoneyReceived(
      [party({ singlePayment: true, total: 45 })],
      FEES,
    );

    expect(money.gross).toBe(0);
    expect(money.outstanding).toBe(4500);
    expect(money.outstandingParties).toBe(1);
  });

  it("keeps money that came in from a party that cancelled since", () => {
    const money = summarizeMoneyReceived(
      [
        party({
          status: "cancelled",
          firstHalf: { paid: true, method: "cash" },
        }),
      ],
      FEES,
    );

    expect(money.payments.cash).toBe(4000);
    expect(money.outstanding).toBe(0);
  });

  it("makes no payment of a free party's ticks", () => {
    const money = summarizeMoneyReceived(
      [
        party({
          total: 0,
          firstHalf: { paid: true, method: "twint" },
          secondHalf: { paid: false, method: "twint" },
        }),
      ],
      FEES,
    );

    expect(money.gross).toBe(0);
    expect(money.twintTransactions).toBe(0);
    expect(money.outstanding).toBe(0);
    expect(money.outstandingParties).toBe(0);
  });
});
