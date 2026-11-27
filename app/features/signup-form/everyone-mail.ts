// Who the "email everyone" message on the signup sheet goes to: everyone
// still coming, for the last details before the dinner. Shared by the sheet,
// which lists who'll get it, and the code that sends it, so the two agree.

import type { MessageRecipient } from "./signup-mails";
import type { SignupStatus } from "./signup-status";

/** The groups an admin can write to all at once: never the cancelled ones. */
export const EVERYONE_MAIL_STATUSES = ["confirmed", "waitlisted"] as const;

export type EveryoneMailStatus = (typeof EVERYONE_MAIL_STATUSES)[number];

export function isEveryoneMailStatus(
  value: unknown,
): value is EveryoneMailStatus {
  return (EVERYONE_MAIL_STATUSES as readonly unknown[]).includes(value);
}

/** A signup, as far as the message to everyone is concerned. */
export interface EveryoneMailParty {
  submissionId: string;
  status: SignupStatus;
  /** From before signup forms: no mail record to keep, so left out. */
  isLegacy: boolean;
  signerEmail: string;
  booking: { guests: readonly { name: string; email: string | null }[] };
  /** Per person, in the order of `booking.guests`. */
  guestBookkeeping: readonly { cancelledAt: Date | null }[];
}

export interface EveryoneMailRecipient extends MessageRecipient {
  submissionId: string;
  status: EveryoneMailStatus;
}

/**
 * Everyone in the groups of the statuses picked that we can write to: the
 * signer, and each friend the signer gave an address for. Cancelled groups
 * and anyone cancelled on their own get nothing. An address listed twice,
 * in one group or two, gets one mail, written for the first of them.
 */
export function everyoneMailRecipients(
  parties: readonly EveryoneMailParty[],
  statuses: readonly EveryoneMailStatus[],
): EveryoneMailRecipient[] {
  const seen = new Set<string>();

  return parties.flatMap((party) => {
    const { status } = party;
    if (party.isLegacy || !isEveryoneMailStatus(status)) return [];
    if (!statuses.includes(status)) return [];

    return party.booking.guests.flatMap((guest, guestIndex) => {
      if (party.guestBookkeeping[guestIndex]?.cancelledAt) return [];
      // the signer's own address, as they typed it, like messageRecipients
      const email = (
        guestIndex === 0 ? party.signerEmail : (guest.email ?? "")
      ).trim();
      if (!email) return [];
      const key = email.toLowerCase();
      if (seen.has(key)) return [];
      seen.add(key);
      return [
        {
          guestIndex,
          name: guest.name,
          email,
          submissionId: party.submissionId,
          status,
        },
      ];
    });
  });
}
