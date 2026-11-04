# CLAUDE.md

Guidance for Claude when working in this repository.

## Project

Web app for the moku pona culinary society in Zürich: public landing, event
pages with signup, gallery, auth (better-auth) and an admin area.

- React Router v7 (framework mode), React 19, TypeScript, Tailwind CSS v4
- Prisma with SQLite; images on Cloudinary (`IMAGE_PROVIDER=local` in dev/CI)
- Railway builds the `Dockerfile` and deploys straight from GitHub: the
  production environment from `main`, the `staging_backend` environment from
  the `staging_backend` branch. Staging is updated by fast-forwarding
  `staging_backend` to `main`. GitHub Actions (`.github/workflows/ci.yml`)
  only runs CI.
- Staging gets the live site's content (not its users) through `/admin/sync`;
  setup is in `docs/live-data-sync/`.
- Roles are `user`, `moderator` and `admin` (`app/features/auth/roles.ts`).
  Invites stop at `moderator`. Admins can promote others to admin on the user
  edit page, but only `scripts/admins.ts` can demote an admin. Keep it that way
  unless the user asks otherwise.

## Layout

- `app/routes`: route modules (file-based routing via `app/routes.ts`)
- `app/features/<feature>`: feature code (auth, events, gallery, images, mail, …)
- `app/models`: server-side data access
- `app/components`: shared UI; `app/components/ui` holds the primitives
- `app/shared`: cross-cutting helpers (HTTP, root loader data, images)
- `app/features/site-text`: every public-facing text, editable at
  `/admin/texts` (see "Public-facing text" below)
- `cypress/e2e`: end-to-end tests; unit tests sit next to the code as `*.test.ts(x)`
- `docs/<topic>/`: design notes, plans and investigations. These are historical
  records, so don't rewrite them to match today's code.

## Public-facing text

Every word a visitor can read (pages, nav, footer, buttons, alt text and
screen-reader labels, page titles, validation messages, toasts and emails)
comes from the site-text registry, so admins can edit it at `/admin/texts`.
Keep it that way with every change:

- New copy goes into `app/features/site-text/registry/<category>.ts`: a key,
  an admin-facing `label`, the `default`, and where needed `vars` for
  `{placeholders}`, `tags` for `<link>…</link>` spans, `kind: "paragraph"` or
  `"document"` for long text and a `hint` saying where it shows. The editor
  picks it up from there; a new category also goes into
  `SITE_TEXT_CATEGORIES`.
- Read it with `const t = useText(); t("key", { vars })` in components,
  `textFromMatches(matches)` in `meta`, and `await getText()` in loaders,
  actions and mails. `<RichText>` renders texts whose placeholders or tags
  stand for markup. Zod schemas with visitor-facing messages are built from
  `t` (see `app/features/auth/form-schemas.ts`).
- Keep keys literal (`t("signup.submit")`, not a key built from a variable):
  a test fails on registry keys that no code uses, so remove an entry when
  its last use goes.
- Rewording a default in code leaves texts an admin already edited alone;
  the editor flags those for review.
- `npm run lint` fails on hardcoded text in public files
  (`eslint-rules/no-hardcoded-text.js`). Admin-only modules are listed in the
  rule's `ignores` in `eslint.config.js`; a string that really isn't copy
  takes an `eslint-disable-next-line` comment with the reason.
- The admin area's own wording is not part of the registry.

## Checks to run before pushing

```sh
npm run lint
DATABASE_URL="file:./prisma/data.db" npm run typecheck   # app + cypress tsconfig
npx vitest --run
npx prettier --check <changed files>
```

`npm run typecheck` runs `prisma generate`, which needs `DATABASE_URL` set (via
`.env` or the environment). Cypress (`npm run test:e2e:run`) builds the app and
needs a seeded database; CI runs it on every PR.

When UI text or links change, grep `cypress/e2e` for the old text, because the
smoke tests select elements by role and accessible name.

## Git and pull requests

- **Branch names must be specific to the change**, in the form
  `<type>/<short-kebab-description>`, for example `fix/navbar-login-link`,
  `chore/remove-fly-config` or `feat/gallery-lightbox`. Types are `feat`, `fix`,
  `chore`, `docs`, `refactor`, `ci` and `test`. Never use generic or
  auto-generated names such as `claude/<random-words>`, `ccr-<id>`, `dev-2`,
  `patch-1` or `update`. If a session gives you a generic branch name, ask the
  user before creating or pushing a specifically named one.
- Commit messages: imperative subject line; conventional prefixes
  (`fix:`, `chore:`, `ci:`) are welcome but not required.
- `main` is protected. `.github/CODEOWNERS` lists `@Apsysikal` and `@MrTarahb`,
  and PRs need a code-owner review. GitHub never lets a PR's author approve it,
  and PRs Claude opens are authored by the user's account.
- Don't open a PR unless asked.
