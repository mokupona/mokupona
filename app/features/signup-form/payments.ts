// The money side of the signup sheet: how each payment came in, what TWINT
// keeps of it, and what has come in so far. A party pays its price in two
// halves, or the whole of it in one payment, and a payment can come in at
// another amount than the one asked for (90 CHF of 95). Amounts here are in Rappen
// (100 to the franc), so halves, donations and fees add up without rounding
// drift; the prices on an event stay whole francs, a person an admin set to
// pay half pays half of theirs, and one an admin set an amount for pays that
// amount, to the Rappen.

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

/**
 * What share of their price one person pays, set by an admin on the signup
 * sheet: all of it, half, nothing, or an amount the admin types in
 * ("custom"). For helpers who sign up so their allergies are on the sheet,
 * but don't pay or pay half, and for anyone who settled on another amount.
 */
export const PRICE_SHARES = ["full", "half", "none", "custom"] as const;

export type PriceShare = (typeof PRICE_SHARES)[number];

export const PRICE_SHARE_LABELS: Record<PriceShare, string> = {
  full: "Pays in full",
  half: "Pays half",
  none: "Doesn't pay",
  custom: "Custom amount",
};

/** Largest amount an admin can set for one person to pay: 10 000 CHF. */
export const MAX_CUSTOM_PRICE_RAPPEN = 1_000_000;

/** Largest amount the sheet takes as one payment that came in: 10 000 CHF. */
export const MAX_RECEIVED_RAPPEN = 1_000_000;

export function isPriceShare(value: unknown): value is PriceShare {
  return (
    typeof value === "string" &&
    (PRICE_SHARES as readonly string[]).includes(value)
  );
}

/** A stored share as the sheet reads it; anything unknown pays in full. */
export function toPriceShare(value: string): PriceShare {
  return isPriceShare(value) ? value : "full";
}

/**
 * What one person pays of their price, in CHF. Half of a whole-franc price
 * can end in 50 Rappen; a custom amount (`customPrice`, in Rappen) can end in
 * any Rappen. A custom share that lost its amount pays in full.
 */
export function priceAfterShare(
  price: number,
  share: PriceShare,
  customPrice: number | null = null,
): number {
  switch (share) {
    case "full":
      return price;
    case "half":
      return price / 2;
    case "none":
      return 0;
    case "custom":
      return customPrice === null ? price : customPrice / 100;
  }
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

/**
 * The first half of a price, in whole Rappen. Half of a price in whole or
 * half francs is exact; a price that ends in an odd Rappen (a custom amount)
 * puts the odd one in the first half, and the second half is the rest.
 */
export function halfPrice(chf: number): number {
  return Math.ceil(chfToRappen(chf) / 2);
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
  /**
   * What actually came in, in Rappen, when an admin noted that it wasn't the
   * amount asked for; null or left out, the amount asked for came in. Counts
   * only while the payment is ticked.
   */
  received?: number | null;
}

/** One signup, as far as the money that came in is concerned. */
export interface PaymentParty {
  status: SignupStatus;
  /** What the whole party pays, in CHF, after each person's price share. */
  total: number;
  /**
   * The party pays the whole total in one payment: `firstHalf` then stands
   * for that payment, and `secondHalf` doesn't count.
   */
  singlePayment: boolean;
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
  /**
   * The ticked payments of the party prices, by how they came in, at what
   * actually came in.
   */
  payments: MethodTotals;
  donations: MethodTotals;
  /** Everything that came in, before TWINT's fees. */
  gross: number;
  /** What TWINT keeps: its fee on each TWINT payment and donation. */
  twintFees: number;
  twintTransactions: number;
  /** What we keep: everything that came in, less TWINT's fees. */
  net: number;
  /**
   * What the confirmed parties still owe: their price less what came in, so
   * the unticked payments and anything a ticked one came in short.
   */
  outstanding: number;
  outstandingParties: number;
}

/**
 * Adds up the money that came in, in Rappen. Each ticked half, each price
 * paid in one go and each donation is one payment, at what actually came in,
 * and each TWINT payment loses its fee on that. A ticked payment counts
 * whatever the signup's status, since the money is in; only a confirmed
 * party still owes the rest of its price.
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
    for (const payment of partyPayments(party)) {
      if (payment.paid) {
        receive(payments, amountIn(payment), payment.method);
      }
    }
    for (const donation of party.donations) {
      receive(donations, donation.amount ?? 0, donation.method);
    }

    const owed = chfToRappen(party.total) - amountReceived(party);
    if (party.status === "confirmed" && owed > 0) {
      outstanding += owed;
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

/** One payment of a party's price, with the amount asked for, in Rappen. */
export type PartyPayment = PaymentHalf & { amount: number };

/**
 * The payments a party's price comes in: two halves, or the whole of it. A
 * party with nothing to pay has none, so nothing it ticked counts.
 */
export function partyPayments(party: PaymentParty): PartyPayment[] {
  const total = chfToRappen(party.total);
  if (total === 0) return [];
  if (party.singlePayment) {
    return [{ ...party.firstHalf, amount: total }];
  }
  const firstHalf = halfPrice(party.total);
  return [
    { ...party.firstHalf, amount: firstHalf },
    { ...party.secondHalf, amount: total - firstHalf },
  ];
}

/** What came in for one ticked payment, in Rappen. */
function amountIn(payment: PartyPayment): number {
  return payment.received ?? payment.amount;
}

/** What came in of a party's price, in Rappen: its ticked payments. */
export function amountReceived(party: PaymentParty): number {
  return partyPayments(party)
    .filter((payment) => payment.paid)
    .reduce((sum, payment) => sum + amountIn(payment), 0);
}
