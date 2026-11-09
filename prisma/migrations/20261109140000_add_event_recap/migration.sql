-- What an event's page says once the dinner is over (how it went, thanks,
-- what's next), in place of the description that invited guests to sign up.
-- Empty on every event so far, which keep showing their description.
ALTER TABLE "Event" ADD COLUMN "recap" TEXT;
