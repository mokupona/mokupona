// The money side of the signup sheet: how each payment came in, what TWINT
// keeps of it, and what has come in so far. Amounts here are in Rappen
// (100 to the franc), so halves, donations and fees add up without rounding
// drift; the prices on an event stay whole francs.

import type { SignupStatus } from "./signup-status";

export const PAYMENT_METHODS = ["twint", "cash"] as const;

export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  twint: "TWINT",
  cash: "Cash",
};

export function isPaymentMethod(value: unknown): value is PaymentMethod {
  return (
    typeof value === "string" &&
    (PAYMENT_METHODS as readonly string[]).includes(value)
  );
}

/** A stored method as the sheet reads it; anything unknown counts as TWINT. */
export function toPaymentMethod(value: string): PaymentMethod {
  return isPaymentMethod(value) ? value : "twint";
}

/** What TWINT keeps of each payment: a share of it plus a fixed sum. */
export interface TwintFees {
  percent: number;
  fixedRappen: number;
}

/** The fees the event columns start at (prisma/schema.prisma). */
export const DEFAULT_TWINT_FEES: TwintFees = { percent: 1.5, fixedRappen: 30 };

export const MAX_TWINT_FEE_PERCENT = 20;
export const MAX_TWINT_FEE_FIXED_RAPPEN = 1000;
/** Largest donation the sheet takes for one person: 10 000 CHF. */
export const MAX_DONATION_RAPPEN = 1_000_000;

/** What TWINT keeps of one payment. Nothing is paid, nothing is kept. */
export function twintFee(amount: number, fees: TwintFees): number {
  if (amount <= 0) return 0;
  return Math.round((amount * fees.percent) / 100) + fees.fixedRappen;
}

export function chfToRappen(chf: number): number {
  return Math.round(chf * 100);
}

/** Half of a price in whole francs, in Rappen: always exact. */
export function halfPrice(chf: number): number {
  return chfToRappen(chf) / 2;
}

/**
 * A number as an admin types it, with at most two decimals after a point or
 * a comma, in hundredths: "7,50" is 750. Empty reads as null (nothing
 * entered); anything else reads as undefined.
 */
function parseHundredths(input: string): number | null | undefined {
  const value = input.trim();
  if (!value) return null;
  if (!/^\d{1,7}([.,]\d{1,2})?$/.test(value)) return undefined;
  return Math.round(Number(value.replace(",", ".")) * 100);
}

/** An amount in francs as an admin types it ("10", "7.50", "7,50 CHF"), in Rappen. */
export function parseChfInput(input: string): number | null | undefined {
  return parseHundredths(input.trim().replace(/\s*CHF$/i, ""));
}

/** A share in percent as an admin types it: "1.5", "1,3 %". */
export function parsePercentInput(input: string): number | null | undefined {
  const hundredths = parseHundredths(input.trim().replace(/\s*%$/, ""));
  return hundredths == null ? hundredths : hundredths / 100;
}

/** An amount in Rappen as the input shows it again: "10", "7.50". */
export function rappenToInput(amount: number | null): string {
  if (amount === null) return "";
  return amount % 100 === 0 ? String(amount / 100) : (amount / 100).toFixed(2);
}

export interface PaymentHalf {
  paid: boolean;
  method: PaymentMethod;
}

/** One signup, as far as the money that came in is concerned. */
export interface PaymentParty {
  status: SignupStatus;
  /** What the whole party pays, in CHF. */
  total: number;
  firstHalf: PaymentHalf;
  secondHalf: PaymentHalf;
  /** Each person's donation, in Rappen; null when they gave nothing. */
  donations: { amount: number | null; method: PaymentMethod }[];
}

export interface MethodTotals {
  twint: number;
  cash: number;
}

export interface MoneyReceived {
  /** The ticked halves of the party prices, by how they came in. */
  payments: MethodTotals;
  donations: MethodTotals;
  /** Everything that came in, before TWINT's fees. */
  gross: number;
  /** What TWINT keeps: its fee on each TWINT payment and donation. */
  twintFees: number;
  twintTransactions: number;
  /** What we keep: everything that came in, less TWINT's fees. */
  net: number;
  /** The unticked halves of the confirmed parties: money still to come. */
  outstanding: number;
  outstandingParties: number;
}

/**
 * Adds up the money that came in, in Rappen. Each ticked half and each
 * donation is one payment, and each TWINT payment loses its fee. A ticked
 * half counts whatever the signup's status, since the money is in; only a
 * confirmed party still owes the halves that aren't ticked.
 */
export function summarizeMoneyReceived(
  parties: readonly PaymentParty[],
  fees: TwintFees,
): MoneyReceived {
  const payments: MethodTotals = { twint: 0, cash: 0 };
  const donations: MethodTotals = { twint: 0, cash: 0 };
  let twintFees = 0;
  let twintTransactions = 0;
  let outstanding = 0;
  let outstandingParties = 0;

  const receive = (
    bucket: MethodTotals,
    amount: number,
    method: PaymentMethod,
  ) => {
    if (amount <= 0) return;
    bucket[method] += amount;
    if (method === "twint") {
      twintFees += twintFee(amount, fees);
      twintTransactions += 1;
    }
  };

  for (const party of parties) {
    const half = halfPrice(party.total);
    let unpaid = 0;

    for (const { paid, method } of [party.firstHalf, party.secondHalf]) {
      if (paid) receive(payments, half, method);
      else unpaid += half;
    }
    for (const donation of party.donations) {
      receive(donations, donation.amount ?? 0, donation.method);
    }

    if (party.status === "confirmed" && unpaid > 0) {
      outstanding += unpaid;
      outstandingParties += 1;
    }
  }

  const gross =
    payments.twint + payments.cash + donations.twint + donations.cash;

  return {
    payments,
    donations,
    gross,
    twintFees,
    twintTransactions,
    net: gross - twintFees,
    outstanding,
    outstandingParties,
  };
}
