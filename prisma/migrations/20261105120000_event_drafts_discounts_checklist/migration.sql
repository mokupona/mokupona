-- Drafts: every event that already exists stays public.
ALTER TABLE "Event" ADD COLUMN "published" BOOLEAN NOT NULL DEFAULT true;

-- Stackable discounts replace the fixed student price. A student price
-- becomes the equivalent deduction, so existing events charge the same.
ALTER TABLE "Event" ADD COLUMN "studentDiscount" INTEGER;
ALTER TABLE "Event" ADD COLUMN "vegetarianDiscount" INTEGER;
UPDATE "Event"
SET "studentDiscount" = MAX(0, "price" - "studentPrice")
WHERE "studentPrice" IS NOT NULL;
ALTER TABLE "Event" DROP COLUMN "studentPrice";

-- CreateTable
CREATE TABLE "EventChecklistItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "label" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "doneAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "eventId" TEXT NOT NULL,
    CONSTRAINT "EventChecklistItem_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "EventChecklistItem_eventId_idx" ON "EventChecklistItem"("eventId");
