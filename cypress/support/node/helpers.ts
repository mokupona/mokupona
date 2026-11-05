// Everything the specs ask of the server side: sessions, users, invites and
// the records the upload specs work with. These run in the one helper
// process Cypress starts per run (server.ts), never in the browser.

import { Prisma } from "#prisma/generated/client";

import { runRecordCommand } from "./records";

import { prisma } from "~/db.server";
import { auth } from "~/features/auth/auth.server";
import { createUserViaAuth } from "~/features/auth/create-user.server";
import { upsertInvite } from "~/models/invite.server";
import { getUserByEmail } from "~/models/user.server";

const SESSION_COOKIE = "better-auth.session_token";
const TEST_USER_PASSWORD = "myreallystrongpassword";

const seededRoleEmails = {
  moderator: "moderator@mokupona.ch",
  admin: "admin@mokupona.ch",
} as const;

function requireTestEmail(email: string) {
  if (!email) throw new Error("email required");
  if (!email.endsWith("@example.com")) {
    throw new Error("All test emails must end in @example.com");
  }
}

/** Signs in and returns the session cookie's value. */
async function sessionCookie(email: string, password: string) {
  const { headers } = await auth.api.signInEmail({
    body: { email, password },
    returnHeaders: true,
  });
  const cookie = (headers.get("set-cookie") ?? "").match(
    new RegExp(`${SESSION_COOKIE.replace(".", "\\.")}=([^;]+)`),
  )?.[1];

  if (!cookie) throw new Error("Session cookie missing from sign-in response");
  return cookie;
}

/** A new verified user, signed in. */
async function createUserSession(email: string) {
  requireTestEmail(email);
  await createUserViaAuth({
    email,
    password: TEST_USER_PASSWORD,
    name: "test user",
    emailVerified: true,
  });
  return sessionCookie(email, TEST_USER_PASSWORD);
}

/** A session for the seeded moderator or admin. */
async function createRoleSession(role: string) {
  const email = seededRoleEmails[role === "admin" ? "admin" : "moderator"];
  try {
    return await sessionCookie(email, "mokupona");
  } catch {
    throw new Error(
      `Seeded ${role} user could not sign in. Run the seed script before Cypress tests.`,
    );
  }
}

async function deleteUser(email: string) {
  requireTestEmail(email);
  try {
    await prisma.user.delete({ where: { email } });
  } catch (error) {
    // already gone is fine
    if (
      !(error instanceof Prisma.PrismaClientKnownRequestError) ||
      error.code !== "P2025"
    ) {
      throw error;
    }
  }
  return null;
}

/** An invite from the seeded admin; returns its token. */
async function createInvite({
  email,
  role,
  expired = false,
}: {
  email: string;
  role: string;
  expired?: boolean;
}) {
  requireTestEmail(email);
  if (role !== "user" && role !== "moderator") {
    throw new Error(`Invalid invite role "${role}"`);
  }
  const roleName: "user" | "moderator" = role;

  const admin = await getUserByEmail(seededRoleEmails.admin);
  if (!admin) {
    throw new Error("Seeded admin not found. Run the seed script first.");
  }

  const invite = await upsertInvite({
    email,
    roleName,
    createdById: admin.id,
  });

  if (expired) {
    await prisma.invite.update({
      where: { id: invite.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
  }

  return invite.token;
}

export const helpers = {
  createUserSession,
  createRoleSession,
  deleteUser,
  createInvite,
  records: ({ action, payload }: { action: string; payload?: unknown }) =>
    runRecordCommand(action, payload),
};

export type HelperName = keyof typeof helpers;

export async function disconnectHelpers() {
  await prisma.$disconnect();
}
