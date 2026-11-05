# moku pona

Web app for the moku pona culinary society in Zurich.

The app includes:

- Public landing page and event pages
- Event signup (RSVP) flow
- Role-based authentication (user, moderator, admin)
- Admin area for events, locations, users, and board members
- CSV export for event signups
- One-click copy of the live site's data into staging (`/admin/sync`)
- SQLite + Prisma data layer

## Tech stack

- React Router v7 (framework mode)
- React 19 + TypeScript
- Tailwind CSS v4
- Prisma ORM with SQLite (`@prisma/adapter-better-sqlite3`)
- Vitest + Testing Library
- Cypress for end-to-end tests
- Railway deployment via Docker

## Requirements

- Node.js 24+
- npm

## Local setup

1. Install dependencies:

   ```sh
   npm install
   ```

2. Create your env file (`.env`) with at least:

   ```env
   DATABASE_URL="file:./prisma/data.db"
   BETTER_AUTH_SECRET="replace-with-a-random-secret"
   ```

3. Initialize database and seed data:

   ```sh
   npm run setup
   ```

4. Start development server:

   ```sh
   npm run dev
   ```

By default, the app runs at `http://localhost:3000`.

## Seeded accounts

`npm run setup` seeds users with password `mokupona`:

- `user@mokupona.ch` (role: user)
- `moderator@mokupona.ch` (role: moderator)
- `admin@mokupona.ch` (role: admin)

## Roles and administrators

Every account has one role:

- `user`: a regular member account
- `moderator`: also gets the admin area (events, locations, board, gallery)
- `admin`: also manages users, invites and settings

Admins can invite people as `user` or `moderator`, and change a non-admin's
role on **Admin → Users → Edit**, including promoting them to administrator.
The website never demotes an administrator. That, and listing who the admins
are, is done with `scripts/admins.ts` in a shell on the production container
(for example `railway ssh`):

```sh
npx tsx scripts/admins.ts list                    # who are the admins?
npx tsx scripts/admins.ts create someone@example.com "Their Name"   # new account, one-time password
npx tsx scripts/admins.ts grant someone@example.com
npx tsx scripts/admins.ts revoke someone@example.com [--to moderator|user]
```

`grant` only works for an existing account, so the person signs up first.
`revoke` demotes to `moderator` by default and refuses to remove the last
admin.

## Environment variables

Required:

- `DATABASE_URL`: Prisma SQLite connection string
- `BETTER_AUTH_SECRET`: better-auth signing secret (also signs toast cookies)

Auth & mail:

- `BETTER_AUTH_URL`: canonical origin for auth callbacks and emailed links (set in production; inferred from the request in local dev)
- `MAIL_PROVIDER`: `console` (dev default), `capture` (e2e), or `resend` (production)
- `RESEND_API_KEY`: required when `MAIL_PROVIDER=resend`
- `MAIL_FROM`: sender address for account mail (verify, reset, invite), defaults to `moku pona <noreply@mokupona.ch>`
- `EVENT_SIGNUP_MAIL_FROM`: sender address for the confirmation mail guests get after signing up for an event, defaults to `moku pona <noreply@mokupona.ch>`. Its domain must be verified in Resend.
- `GUEST_MAIL_COPY_TO`: the team inbox that gets a copy of every email to a guest (the signup mail, the note to a friend, a message written on the signup sheet), each under a line naming the guest. Defaults to `mokuponadinnerclub@gmail.com`; set it to an empty string to turn the copies off, e.g. on staging.
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`: Google OAuth; the "Continue with Google" buttons hide while unset

Optional:

- `ALLOW_INDEXING`: set to `false` to disable search engine indexing tags
- `PORT`: server port (defaults to `3000`)

Live data sync (copy the live site's content into staging from `/admin/sync`, see [`docs/live-data-sync/`](docs/live-data-sync/README.md)):

- `LIVE_DATA_TOKEN`: shared secret (`openssl rand -hex 32`), the same value on the live site and on every copy target
- `LIVE_DATA_SOURCE_URL`: set only on a copy target, the live site's public `https://` address. Never set it on production

## Useful scripts

- `npm run dev`: start dev server (with MSW mock server)
- `npm run build`: build production assets
- `npm run start`: serve production build
- `npm run setup`: generate Prisma client, apply migrations, seed database
- `npm run prisma:studio`: open Prisma Studio
- `npm run test`: run unit tests
- `npm run test:e2e:dev`: open Cypress against dev server
- `npm run test:e2e:ci`: run the CI-oriented Cypress command against a prebuilt app
- `npm run test:e2e:run`: run Cypress in headless mode
- `npm run lint`: run ESLint
- `npm run typecheck`: run TypeScript checks
- `npm run validate`: run test + lint + typecheck + e2e

## Project structure

- `app/routes`: route modules (public pages + admin area)
- `app/models`: server-side data access helpers
- `app/components`: reusable UI and feature components
- `prisma/schema.prisma`: database schema
- `prisma/seed.ts`: seed data
- `cypress/e2e`: end-to-end tests

## Deployment

The site runs on [Railway](https://railway.com), which deploys directly from
GitHub:

| Railway environment | Deploys branch    |
| ------------------- | ----------------- |
| production          | `main`            |
| `staging_backend`   | `staging_backend` |

To update staging, fast-forward `staging_backend` to `main`. Staging pulls the
live site's content from **Admin → Sync** (see
[`docs/live-data-sync/`](docs/live-data-sync/README.md)), and
`npx tsx scripts/admins.ts create <email>` makes the first admin on an empty
database.

GitHub Actions only runs CI (lint, typecheck, Vitest, Cypress) on pull requests
and on pushes to `main` and `dev`; it does not deploy.

This project uses:

- `Dockerfile` for the production image build
- `start.sh` for boot-time Prisma migrations, log rotation (`cron` +
  `logrotate.conf`) and server startup

Runtime details:

- Runtime configuration (`DATABASE_URL`, `MAIL_PROVIDER`, `BETTER_AUTH_*`,
  `RESEND_API_KEY`, Google OAuth, Cloudinary, …) is set as variables on the
  Railway service
- `DATABASE_URL` must point at a SQLite file on a persistent volume
- `start.sh` runs `prisma migrate deploy` before starting the app, so
  migrations apply on every boot
- Health endpoint: `/healthcheck`

## Testing

- Unit/integration tests: `npm run test`
- E2E interactive: `npm run test:e2e:dev`
- E2E CI/headless: `npm run test:e2e:ci`
- E2E local headless: `npm run test:e2e:run`

For full local verification, run:

```sh
npm run validate
```
