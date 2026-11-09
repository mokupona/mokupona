-- The event checklist is split into categories (general, logistics,
-- decorations, socials, menu). Everything starts in "general"; the usual
-- items every event was given move to where they now belong.
ALTER TABLE "EventChecklistItem" ADD COLUMN "category" TEXT NOT NULL DEFAULT 'general';

UPDATE "EventChecklistItem"
SET "category" = 'logistics'
WHERE "label" IN (
    'Confirm the location',
    'Line up volunteers for cooking and serving'
);

UPDATE "EventChecklistItem"
SET "category" = 'menu'
WHERE "label" IN (
    'Plan the menu',
    'Buy groceries and drinks'
);

UPDATE "EventChecklistItem"
SET "category" = 'socials'
WHERE "label" IN (
    'Hire / ask a photographer',
    'Announce the dinner (newsletter, Instagram)',
    'Upload photos to the gallery'
);
