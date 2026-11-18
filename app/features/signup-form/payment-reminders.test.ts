import { describe, expect, it } from "vitest";

import { isPaymentReminderDue, type ReminderParty } from "./payment-reminders";

const due: ReminderParty = {
  status: "confirmed",
  isLegacy: false,
  firstHalfPaid: false,
  paymentReminderSent: false,
  amountDue: 40,
  signerEmail: "ada@example.com",
};

describe("isPaymentReminderDue", () => {
  it("is due for a confirmed group that hasn't paid its first half", () => {
    expect(isPaymentReminderDue(due)).toBe(true);
  });

  it.each([
    ["on the waiting list", { status: "waitlisted" }],
    ["cancelled", { status: "cancelled" }],
    ["from before signup forms", { isLegacy: true }],
    ["that paid its first half", { firstHalfPaid: true }],
    ["already reminded", { paymentReminderSent: true }],
    ["of helpers who don't pay", { amountDue: 0 }],
    ["without an address", { signerEmail: "  " }],
  ] as [string, Partial<ReminderParty>][])(
    "isn't due for a group %s",
    (_, change) => {
      expect(isPaymentReminderDue({ ...due, ...change })).toBe(false);
    },
  );
});
