# Live data sync

Copy the live site's content into staging (or a laptop) with one click at
`/admin/sync`. Production runs on Railway; this is the runbook for wiring it up.

## What it does

```
staging  /admin/sync  ── GET /api/live-data  (Authorization: Bearer <token>) ──>  live site (Railway)
         replaces its own content tables in one transaction  <── JSON snapshot ──
```

- **Copied:** events, locations, signup forms (all versions), signups
  (optional), gallery links and captions, board members, and the image rows
  they point at.
- **Never copied:** users, password hashes, Google accounts and OAuth tokens,
  sessions, verification tokens, invites and roles. Every select on the live
  side is an explicit allowlist, so a column added later stays put until
  someone adds it on purpose.
- **Kept on the target:** its own users and logins, so whoever clicked the
  button is still logged in afterwards. An event's creator is matched by email
  against the target's accounts, and cleared if there's no match.
- **Atomic:** the target deletes and re-inserts inside one database
  transaction. Any failure (bad data, schema mismatch, network) leaves the
  target exactly as it was.
- **Read-only on the live site.** The export endpoint only reads.

### Roles are fixed by configuration

| Variables set                              | Instance is   | `/api/live-data`   | `/admin/sync` button |
| ------------------------------------------ | ------------- | ------------------ | -------------------- |
| `LIVE_DATA_TOKEN`                          | the live site | answers with token | none: can't import   |
| `LIVE_DATA_TOKEN` + `LIVE_DATA_SOURCE_URL` | a copy target | 404                | yes                  |
| neither                                    | feature off   | 404                | none                 |

So the live site can never be overwritten from its own admin panel, and a
staging copy can never pose as a source.

### Images

- **Same Cloudinary cloud on both sides** (the normal Railway setup: one
  `mokupona` cloud, `CLOUDINARY_FOLDER_PREFIX` = `prod` / `staging`): image
  rows are copied as they are and point at the live site's assets. No bytes
  move. To keep that safe, the Cloudinary provider now looks up an asset's
  folder before destroying it and **only destroys assets inside its own
  `CLOUDINARY_FOLDER_PREFIX`**. Deleting a copied event on staging leaves the
  live photos alone. This only works if the two prefixes differ.
- **Anything else** (local dev on `IMAGE_PROVIDER=local`, a different cloud, a
  live site on local storage): every image is downloaded from the source and
  stored with the target's own provider. A second run reuses copies already
  made, so only new photos are downloaded.

An image that can't be downloaded is left out, along with the cover, portrait
or gallery slots that showed it, and the success toast says how many were
skipped.

## Railway setup

### 1. Generate the shared token

On your machine:

```sh
openssl rand -hex 32
```

Keep it in the password manager. Anyone holding it can read every event and
every guest's signup, so treat it like an admin password. At least 32
characters are required; shorter values switch the feature off.

### 2. Live site (production environment)

1. Make sure production runs a build that includes this feature. Railway deploys
   `main` itself, so the code has to be merged there first. Until then the
   staging button reports "The live site doesn't offer its data". Staging
   deploys the `staging_backend` branch, so fast-forward that to `main` too.
2. Railway dashboard → the moku pona project → **production** environment →
   the web service → **Variables** → **New Variable**:
   - `LIVE_DATA_TOKEN` = the token from step 1
   - Optional: use the variable's ⋮ menu to **seal** it. Sealed values are
     hidden from the dashboard and CLI, and aren't copied when you duplicate
     the environment, so a staging copy won't inherit it by accident.
3. Do **not** set `LIVE_DATA_SOURCE_URL` here.
4. Railway stages variable changes. Click **Deploy** on the staged changes to
   apply them.
5. Check it from your machine (use the address the site is served from, e.g.
   the custom domain):

   ```sh
   curl -s -H "Authorization: Bearer <token>" "https://mokupona.ch/api/live-data?summary=1"
   ```

   You should get JSON with `counts`. Without the header the answer is `401`,
   and every export and refused token is logged on the live site.

### 3. Staging on Railway (skip if staging already exists)

1. Project → environment switcher → **New Environment** → **Duplicate
   environment** from `production`. This project's is named `staging_backend`. Railway copies services
   and variables, minus sealed ones. Volumes are new and **empty**: staging gets
   its own `/data`, never production's.
2. Staging web service → **Settings**:
   - **Source**: deploy from the `staging_backend` branch, not `main`.
   - **Networking** → **Generate Domain**, or add a custom one.
   - Check that a volume is attached at `/data`, and that `DATABASE_URL` is
     `file:/data/sqlite.db`.
3. Staging **Variables**. The duplicate carries production's values, so change
   these:

   | Variable                   | Staging value                                                                    |
   | -------------------------- | -------------------------------------------------------------------------------- |
   | `BETTER_AUTH_URL`          | the staging domain, e.g. `https://staging-mokupona.up.railway.app`               |
   | `BETTER_AUTH_SECRET`       | a new `openssl rand -hex 32`, never production's                                 |
   | `CLOUDINARY_FOLDER_PREFIX` | `staging`. **Must differ from production's** (`prod`): the delete guard needs it |
   | `ALLOW_INDEXING`           | `false`                                                                          |
   | `GOOGLE_CLIENT_*`          | remove, or add the staging callback URL to the Google OAuth client               |

4. Deploy. A fresh staging database has no accounts yet, so create the first
   admin from a shell inside the container (needs the
   [Railway CLI](https://docs.railway.com/cli)):

   ```sh
   railway link            # pick the project, the staging environment and the web service
   railway ssh             # opens a shell in the running container
   npx tsx scripts/admins.ts create you@example.com "Your Name"
   ```

   It prints a one-time password. Log in with it, then change it on the
   **account** page (`/me`).

### 4. Turn staging into a copy target

Staging service → **Variables**:

- `LIVE_DATA_TOKEN` = the same token as production (exactly the same)
- `LIVE_DATA_SOURCE_URL` = the live site's public address, e.g.
  `https://mokupona.ch`. Use the address it's actually served from: if the
  apex redirects to `www`, use the `www` one. The copy refuses to follow
  redirects so the token never travels somewhere unexpected. Has to be
  `https://` (plain `http://` only works for `localhost`).

Click **Deploy** on the staged changes.

### 5. Copy

On staging: **admin area → sync**.

1. **Check live site** confirms the connection and shows a here-vs-live count
   table, plus whether photos will be shared or downloaded.
2. **Copy live data** → untick "Include guests' signups" if you don't want
   guests' personal details on staging → **Replace with live data**.

Repeat whenever staging should catch up. Each run replaces everything again.

## Other targets

**Local dev:** add both variables to `.env` and use `/admin/sync` on
`localhost:3000`. With the default `IMAGE_PROVIDER=local`, photos are downloaded
into `IMAGE_UPLOAD_FOLDER`. Copying real signups onto a laptop is rarely
needed, so leave the box unticked.

## Troubleshooting (the messages the page shows)

| Message                                                 | Fix                                                                                      |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| "The live site doesn't offer its data"                  | Production lacks `LIVE_DATA_TOKEN`, has `LIVE_DATA_SOURCE_URL` set, or runs older code   |
| "The live site turned the token down"                   | The two `LIVE_DATA_TOKEN` values differ (watch for stray spaces or quotes)               |
| "… redirected to …"                                     | Set `LIVE_DATA_SOURCE_URL` to the address in the message                                 |
| "… is on migration X, which this site doesn't have yet" | Production is ahead: deploy the latest code to staging first                             |
| "… format this version can't read"                      | The two deploys run different versions of this feature: deploy both from the same commit |
| "LIVE_DATA_SOURCE_URL points at this site itself"       | Staging's source URL is its own domain                                                   |

## Limits

- The copy is one HTTP request. Railway drops a request that sends no data
  for 5 minutes. Shared-image copies take seconds; the first downloading copy
  of a large photo archive is the slow case, and later runs reuse what's there.
- Snapshots over 200 MB and single images over 15 MB are refused.

## Rotating the token

Set a new value on both sides and deploy both. The old token stops working as
soon as production redeploys.

## Code map

- `app/routes/api.live-data.ts`: the export endpoint (live site)
- `app/routes/admin.sync.tsx`: the admin page and copy action (target)
- `app/features/live-data/`: config, snapshot format, export, import, images
- `app/models/live-data.server.ts`: allowlisted reads and the transactional
  replace
- `app/features/images/providers/cloudinary.server.ts`: the own-folder delete
  guard
- `scripts/admins.ts create`: first admin on an empty database
