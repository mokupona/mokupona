-- What share of their price one person in a signup pays, set by an admin on
-- the signup sheet: "full", "half" or "none" (helpers who sign up so their
-- allergies are on the sheet). Everyone so far pays in full.
ALTER TABLE "SignupGuest" ADD COLUMN "priceShare" TEXT NOT NULL DEFAULT 'full';
