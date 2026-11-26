-- What actually came in for each payment of a signup, in Rappen, when an
-- admin noted on the signup sheet that it wasn't the amount asked for. Every
-- payment so far came in at the amount asked for.
ALTER TABLE "FormSubmission" ADD COLUMN "firstHalfReceivedRappen" INTEGER;
ALTER TABLE "FormSubmission" ADD COLUMN "secondHalfReceivedRappen" INTEGER;
