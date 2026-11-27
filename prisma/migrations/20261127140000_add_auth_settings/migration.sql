-- The self-service switches at /admin/settings (email sign-ups, Google),
-- kept in the database so they survive restarts and deploys. A toggle with
-- no row is on, so every site starts out as before: both open.
CREATE TABLE "AuthSetting" (
    "toggle" TEXT NOT NULL PRIMARY KEY,
    "enabled" BOOLEAN NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
