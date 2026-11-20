-- When one person in a signup dropped out while the rest of the group still
-- comes, set by an admin on the signup sheet. A cancelled person takes no
-- seat, pays nothing and is left out of the group's mails. Nobody so far is.
ALTER TABLE "SignupGuest" ADD COLUMN "cancelledAt" DATETIME;
