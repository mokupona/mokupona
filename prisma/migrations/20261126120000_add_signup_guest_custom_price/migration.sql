-- What one person in a signup pays when an admin set the amount themselves on
-- the signup sheet (priceShare "custom"), in Rappen. Nobody has one yet.
ALTER TABLE "SignupGuest" ADD COLUMN "customPriceRappen" INTEGER;
