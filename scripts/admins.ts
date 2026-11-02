import "dotenv/config";

import {
  grantAdminRoleByEmail,
  listAdmins,
  revokeAdminRoleByEmail,
} from "~/models/user.server";

const USAGE = `Manage website administrators.

Usage:
  npx tsx scripts/admins.ts list
  npx tsx scripts/admins.ts grant <email>
  npx tsx scripts/admins.ts revoke <email> [--to moderator|user]

grant   promotes an existing account to admin (the person must sign up first)
revoke  demotes an admin, to moderator unless --to says otherwise; the last
        remaining admin cannot be revoked`;

class CliError extends Error {}

// Throw rather than process.exit(): exiting early races the app logger's
// async stream and prints a "sonic boom is not ready" crash on the way out.
function fail(message: string): never {
  throw new CliError(message);
}

async function list() {
  const admins = await listAdmins();
  if (admins.length === 0) {
    console.log("No administrators.");
    return;
  }
  console.log(`${admins.length} administrator(s):`);
  for (const admin of admins) {
    const since = admin.createdAt.toISOString().slice(0, 10);
    console.log(`- ${admin.email} (${admin.name}, account since ${since})`);
  }
}

async function grant(email: string) {
  const result = await grantAdminRoleByEmail(email);
  switch (result) {
    case "granted":
      console.log(`${email} is now an administrator.`);
      return;
    case "already-admin":
      console.log(`${email} is already an administrator.`);
      return;
    case "user-not-found":
      return fail(
        `No account with email ${email}. They need to sign up first.`,
      );
  }
}

async function revoke(email: string, to: string) {
  if (to !== "moderator" && to !== "user") {
    fail(`--to must be "moderator" or "user", got "${to}".`);
  }
  const result = await revokeAdminRoleByEmail(email, to);
  switch (result) {
    case "revoked":
      console.log(`${email} is no longer an administrator (now ${to}).`);
      return;
    case "not-admin":
      console.log(`${email} is not an administrator.`);
      return;
    case "user-not-found":
      return fail(`No account with email ${email}.`);
    case "last-admin":
      return fail(`${email} is the last administrator and cannot be revoked.`);
  }
}

async function main() {
  const [command, email, ...rest] = process.argv.slice(2);

  switch (command) {
    case "list":
      return list();
    case "grant":
      if (!email) fail(USAGE);
      return grant(email);
    case "revoke": {
      if (!email) fail(USAGE);
      const toIndex = rest.indexOf("--to");
      const to = toIndex === -1 ? "moderator" : (rest[toIndex + 1] ?? "");
      return revoke(email, to);
    }
    default:
      return fail(USAGE);
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof CliError ? error.message : error);
  process.exitCode = 1;
});
