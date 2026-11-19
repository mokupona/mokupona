import type { PaymentMethod, PriceShare } from "./payments";

/** Longest note an admin can keep on a signup. Shared by the page and the model. */
export const MAX_ADMIN_NOTE_LENGTH = 2000;

/**
 * The admin's bookkeeping for one person in a signup (the SignupGuest rows
 * in prisma/schema.prisma): whether they've arrived, what they gave, what
 * share of their price they pay, and whether they're a helper.
 */
export interface GuestBookkeeping {
  arrivedAt: Date | null;
  /** What they gave on the night, in Rappen; null when nothing is entered. */
  donation: number | null;
  donationMethod: PaymentMethod;
  /** All of their price, half of it, or nothing. */
  priceShare: PriceShare;
  /** Works the dinner: takes no seat and isn't counted as a guest. */
  helper: boolean;
}

/** A person nobody has ticked or noted anything for yet. */
export const EMPTY_GUEST_BOOKKEEPING: GuestBookkeeping = {
  arrivedAt: null,
  donation: null,
  donationMethod: "twint",
  priceShare: "full",
  helper: false,
};
