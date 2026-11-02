-- Signups get a status, a seat count and a normalized email so capacity and
-- duplicates can be checked without reading every answers document. Signups
-- stored before this were all accepted, so they backfill as confirmed.

-- AlterTable
ALTER TABLE "FormSubmission" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'confirmed';
ALTER TABLE "FormSubmission" ADD COLUMN "seats" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "FormSubmission" ADD COLUMN "email" TEXT NOT NULL DEFAULT '';

-- Backfill: the signer plus every entry of the "friends" list, and the
-- signer's email as typed
UPDATE "FormSubmission"
SET
    "seats" = 1 + COALESCE(json_array_length("answers", '$.friends'), 0),
    "email" = lower(trim(COALESCE(json_extract("answers", '$.email'), '')))
WHERE json_valid("answers");

-- The single signup-mail copy becomes the "seat confirmed" copy, next to a
-- new "waiting list" copy
ALTER TABLE "Event" RENAME COLUMN "signupMailSubject" TO "confirmedMailSubject";
ALTER TABLE "Event" RENAME COLUMN "signupMailMessage" TO "confirmedMailMessage";
ALTER TABLE "Event" ADD COLUMN "waitlistMailSubject" TEXT;
ALTER TABLE "Event" ADD COLUMN "waitlistMailMessage" TEXT;
