import type { Prisma, Role, User } from "#prisma/generated/client";

import { prisma } from "~/db.server";

export type { User } from "#prisma/generated/client";

export async function getUserByIdWithRole(
  id: string,
): Promise<(User & { role: Role }) | null> {
  return prisma.user.findUnique({ where: { id }, include: { role: true } });
}

export async function getUserByEmail(email: string): Promise<User | null> {
  return prisma.user.findUnique({ where: { email: email.toLowerCase() } });
}

export async function countUsers(): Promise<number> {
  return prisma.user.count();
}

export async function listUsersWithRoleName(): Promise<
  { id: string; email: string; role: { name: string } }[]
> {
  return prisma.user.findMany({
    select: { id: true, email: true, role: { select: { name: true } } },
  });
}

export async function getUserAccountSummary(id: string): Promise<{
  name: string;
  email: string;
  emailVerified: boolean;
  role: { name: string; description: string };
} | null> {
  return prisma.user.findUnique({
    where: { id },
    select: {
      name: true,
      email: true,
      emailVerified: true,
      role: { select: { name: true, description: true } },
    },
  });
}

export async function getUserAuthOverview(id: string): Promise<{
  hasPassword: boolean;
  googleLinked: boolean;
  sessionCount: number;
}> {
  const [accounts, sessionCount] = await Promise.all([
    prisma.account.findMany({
      where: { userId: id },
      select: { providerId: true },
    }),
    prisma.session.count({
      where: { userId: id, expiresAt: { gt: new Date() } },
    }),
  ]);

  return {
    hasPassword: accounts.some((a) => a.providerId === "credential"),
    googleLinked: accounts.some((a) => a.providerId === "google"),
    sessionCount,
  };
}

/** The Better Auth account row linking the user to `providerId`, if any. */
export async function getLinkedAccountId(
  userId: string,
  providerId: string,
): Promise<string | null> {
  const account = await prisma.account.findFirst({
    where: { userId, providerId },
    select: { id: true },
  });
  return account?.id ?? null;
}

export async function updateUserName(id: string, name: string): Promise<void> {
  await prisma.user.update({ where: { id }, data: { name } });
}

export async function setUserEmailVerified(id: string): Promise<void> {
  await prisma.user.update({
    where: { id },
    data: { emailVerified: true },
  });
}

export async function updateNonAdminUserRole(
  userId: string,
  roleId: string,
): Promise<void> {
  await prisma.user.update({
    where: { id: userId, role: { NOT: { name: "admin" } } },
    data: { roleId },
  });
}

export async function listAdmins(): Promise<
  { id: string; email: string; name: string; createdAt: Date }[]
> {
  return prisma.user.findMany({
    where: { role: { name: "admin" } },
    select: { id: true, email: true, name: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });
}

export type GrantAdminResult = "granted" | "already-admin" | "user-not-found";

/**
 * Promotes a user to admin by email. Admin is never granted by invite, so
 * this and the admin user edit page are the only ways in.
 */
export async function grantAdminRoleByEmail(
  email: string,
): Promise<GrantAdminResult> {
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: { email: email.toLowerCase() },
      include: { role: true },
    });
    if (!user) return "user-not-found";
    if (user.role.name === "admin") return "already-admin";

    const adminRole = await tx.role.findUniqueOrThrow({
      where: { name: "admin" },
    });
    await tx.user.update({
      where: { id: user.id },
      data: { roleId: adminRole.id },
    });
    return "granted";
  });
}

export type RevokeAdminResult =
  "revoked" | "not-admin" | "user-not-found" | "last-admin";

/**
 * Demotes an admin by email. The website never demotes admins; this is the
 * only way out of the role. Refuses to remove the last remaining admin.
 */
export async function revokeAdminRoleByEmail(
  email: string,
  toRoleName: "moderator" | "user",
): Promise<RevokeAdminResult> {
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: { email: email.toLowerCase() },
      include: { role: true },
    });
    if (!user) return "user-not-found";
    if (user.role.name !== "admin") return "not-admin";

    const adminCount = await tx.user.count({
      where: { role: { name: "admin" } },
    });
    if (adminCount <= 1) return "last-admin";

    const role = await tx.role.findUniqueOrThrow({
      where: { name: toRoleName },
    });
    await tx.user.update({
      where: { id: user.id },
      data: { roleId: role.id },
    });
    return "revoked";
  });
}

async function deleteUserInTx(tx: Prisma.TransactionClient, id: string) {
  return tx.user.delete({ where: { id } });
}

export async function deleteUserById(id: string): Promise<User> {
  return prisma.$transaction((tx) => deleteUserInTx(tx, id));
}

export async function deleteNonAdminUserById(id: string): Promise<User | null> {
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: { id },
      include: { role: true },
    });
    if (!user || user.role.name === "admin") return null;

    return deleteUserInTx(tx, id);
  });
}
