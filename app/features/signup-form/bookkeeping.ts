import type { PaymentMethod, PriceShare } from "./payments";

/** Longest note an admin can keep on a signup. Shared by the page and the model. */
export const MAX_ADMIN_NOTE_LENGTH = 2000;

/**
 * The admin's bookkeeping for one person in a signup (the SignupGuest rows
 * in prisma/schema.prisma): whether they've arrived, what they gave, what
 * share of their price they pay, whether they're a helper, and whether they
 * were cancelled on their own.
 */
export interface GuestBookkeeping {
  arrivedAt: Date | null;
  /** What they gave on the night, in Rappen; null when nothing is entered. */
  donation: number | null;
  donationMethod: PaymentMethod;
  /** All of their price, half of it, nothing, or `customPrice`. */
  priceShare: PriceShare;
  /** What they pay when `priceShare` is custom, in Rappen; null otherwise. */
  customPrice: number | null;
  /** Works the dinner: takes no seat and isn't counted as a guest. */
  helper: boolean;
  /**
   * When they dropped out while the rest of their group still comes: they
   * take no seat, pay nothing and aren't counted. null while they're in.
   */
  cancelledAt: Date | null;
}

/** A person nobody has ticked or noted anything for yet. */
export const EMPTY_GUEST_BOOKKEEPING: GuestBookkeeping = {
  arrivedAt: null,
  donation: null,
  donationMethod: "twint",
  priceShare: "full",
  customPrice: null,
  helper: false,
  cancelledAt: null,
};
