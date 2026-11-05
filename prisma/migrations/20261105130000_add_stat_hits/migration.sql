-- CreateTable
CREATE TABLE "StatHit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "day" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "eventId" TEXT,
    "visitor" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "referrer" TEXT,
    "device" TEXT NOT NULL,
    "detail" TEXT
);

-- CreateIndex
CREATE INDEX "StatHit_day_kind_idx" ON "StatHit"("day", "kind");

-- CreateIndex
CREATE INDEX "StatHit_eventId_kind_idx" ON "StatHit"("eventId", "kind");
