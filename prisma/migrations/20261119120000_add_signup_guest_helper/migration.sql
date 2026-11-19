-- Whether one person in a signup is a helper, ticked by an admin on the
-- signup sheet. Helpers sign up so their allergies are on the sheet; they
-- don't take a seat or count as a guest. Nobody so far is one.
ALTER TABLE "SignupGuest" ADD COLUMN "helper" BOOLEAN NOT NULL DEFAULT false;
