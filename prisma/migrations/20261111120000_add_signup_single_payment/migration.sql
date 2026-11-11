-- Whether a party paid the whole price in one payment instead of two halves,
-- ticked by an admin on the signup sheet. Every signup so far pays in halves.
ALTER TABLE "FormSubmission" ADD COLUMN "singlePayment" BOOLEAN NOT NULL DEFAULT false;
