-- When an admin closed an event's signups from the signup sheet. null keeps
-- them open, so every event already on the site stays open for signups.
ALTER TABLE "Event" ADD COLUMN "signupsClosedAt" DATETIME;
