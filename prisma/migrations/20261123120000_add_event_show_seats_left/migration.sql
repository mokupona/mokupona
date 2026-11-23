-- Whether the event page tells guests how many seats are still free. Off by
-- default, so every event, the ones already on the site included, only shows
-- its number of seats (and once it's full, that it's fully booked).
ALTER TABLE "Event" ADD COLUMN "showSeatsLeft" BOOLEAN NOT NULL DEFAULT false;
