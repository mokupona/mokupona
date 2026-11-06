import type { SignupStatus } from "./signup-status";

/** One signup, as far as its money is concerned. */
export interface RevenueParty {
  status: SignupStatus;
  /** How many people it covers, the signer included. */
  people: number;
  /** What the whole party pays, in CHF. */
  total: number;
}

export interface RevenueSummary {
  /** What the confirmed parties pay: the money we expect for the dinner. */
  confirmedTotal: number;
  confirmedPeople: number;
  /** What the waiting list would pay if every group got a seat. */
  waitlistTotal: number;
  waitlistPeople: number;
  /** Per confirmed person, students at the student price; null with nobody. */
  averagePerPerson: number | null;
}

/**
 * Cancelled signups count for nothing. Everything else is summed per status,
 * so the admin can see the money in hand apart from the money still possible.
 */
export function summarizeRevenue(parties: RevenueParty[]): RevenueSummary {
  let confirmedTotal = 0;
  let confirmedPeople = 0;
  let waitlistTotal = 0;
  let waitlistPeople = 0;

  for (const party of parties) {
    if (party.status === "confirmed") {
      confirmedTotal += party.total;
      confirmedPeople += party.people;
    } else if (party.status === "waitlisted") {
      waitlistTotal += party.total;
      waitlistPeople += party.people;
    }
  }

  return {
    confirmedTotal,
    confirmedPeople,
    waitlistTotal,
    waitlistPeople,
    averagePerPerson:
      confirmedPeople > 0
        ? Math.round((confirmedTotal / confirmedPeople) * 100) / 100
        : null,
  };
}

/**
 * The admin reads money as plain numbers; CHF follows the amount. Whole
 * francs stay whole, anything else shows its Rappen: "37.50 CHF".
 */
export function formatCHF(amount: number): string {
  return Number.isInteger(amount)
    ? `${amount} CHF`
    : `${amount.toFixed(2)} CHF`;
}

/** An amount in Rappen (100 to the franc), read the same way. */
export function formatRappen(amount: number): string {
  return formatCHF(amount / 100);
}
