// Who the payment reminder on the signup sheet goes to. Shared by the sheet,
// which says who's due, and the code that sends it, so the two agree.

import type { SignupStatus } from "./signup-status";

/** A signup, as far as its payment reminder is concerned. */
export interface ReminderParty {
  status: SignupStatus;
  /** From before signup forms: no bookkeeping, nothing to send. */
  isLegacy: boolean;
  /** The first half is in (or, in one payment, the whole price). */
  firstHalfPaid: boolean;
  paymentReminderSent: boolean;
  /** What the party pays after anyone set to pay half or nothing, in CHF. */
  amountDue: number;
  signerEmail: string;
}

/**
 * Whether a signup should get the payment reminder: a confirmed seat whose
 * first half hasn't come in, that owes something, that hasn't been reminded
 * (by the reminder, or by an admin's tick) and that we can write to. The
 * second half is paid on the night, so it never calls for one.
 */
export function isPaymentReminderDue(party: ReminderParty): boolean {
  return (
    party.status === "confirmed" &&
    !party.isLegacy &&
    !party.firstHalfPaid &&
    !party.paymentReminderSent &&
    party.amountDue > 0 &&
    party.signerEmail.trim() !== ""
  );
}
