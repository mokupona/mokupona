import { describe, expect, it } from "vitest";

import {
  buildEventData,
  createTestUser,
  ensureAuthRoles,
} from "../../test/factories";

import { createEvent } from "./event.server";
import {
  deleteNonAdminUserById,
  grantAdminRoleByEmail,
  listAdmins,
  revokeAdminRoleByEmail,
} from "./user.server";

import { prisma } from "~/db.server";

describe("deleteNonAdminUserById", () => {
  it("deletes a non-admin user", async () => {
    const user = await createTestUser("user");

    await expect(deleteNonAdminUserById(user.id)).resolves.toMatchObject({
      id: user.id,
    });
    await expect(
      prisma.user.findUnique({ where: { id: user.id } }),
    ).resolves.toBeNull();
  });

  it("does not delete an admin user", async () => {
    const admin = await createTestUser("admin");

    await expect(deleteNonAdminUserById(admin.id)).resolves.toBeNull();
    await expect(
      prisma.user.findUnique({ where: { id: admin.id } }),
    ).resolves.not.toBeNull();
  });

  it("keeps an owned event, clearing authorship (SetNull)", async () => {
    const data = await buildEventData();
    const event = await createEvent(data);

    await deleteNonAdminUserById(data.createdById);

    const after = await prisma.event.findUniqueOrThrow({
      where: { id: event.id },
    });
    expect(after.createdById).toBeNull();
    await expect(
      prisma.form.findUnique({ where: { id: event.formId } }),
    ).resolves.not.toBeNull();
    await expect(
      prisma.image.findFirst({ where: { event: { id: event.id } } }),
    ).resolves.not.toBeNull();
  });

  it("treats a missing user as an idempotent no-op", async () => {
    await expect(deleteNonAdminUserById("does-not-exist")).resolves.toBeNull();
  });
});

async function roleOf(id: string) {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id },
    include: { role: true },
  });
  return user.role.name;
}

describe("listAdmins", () => {
  it("lists admins and nobody else", async () => {
    const admin = await createTestUser("admin");
    const moderator = await createTestUser("moderator");

    const emails = (await listAdmins()).map((a) => a.email);

    expect(emails).toContain(admin.email);
    expect(emails).not.toContain(moderator.email);
  });
});

describe("grantAdminRoleByEmail", () => {
  it("promotes an existing user, matching email case-insensitively", async () => {
    await ensureAuthRoles();
    const user = await createTestUser("user");

    await expect(grantAdminRoleByEmail(user.email.toUpperCase())).resolves.toBe(
      "granted",
    );
    await expect(roleOf(user.id)).resolves.toBe("admin");
  });

  it("reports an admin as already promoted", async () => {
    const admin = await createTestUser("admin");

    await expect(grantAdminRoleByEmail(admin.email)).resolves.toBe(
      "already-admin",
    );
  });

  it("reports an unknown email", async () => {
    await expect(grantAdminRoleByEmail("nobody@example.com")).resolves.toBe(
      "user-not-found",
    );
  });
});

describe("revokeAdminRoleByEmail", () => {
  it("demotes an admin to the requested role", async () => {
    await ensureAuthRoles();
    await createTestUser("admin");
    const admin = await createTestUser("admin");

    await expect(revokeAdminRoleByEmail(admin.email, "user")).resolves.toBe(
      "revoked",
    );
    await expect(roleOf(admin.id)).resolves.toBe("user");
  });

  it("leaves a non-admin alone", async () => {
    const moderator = await createTestUser("moderator");

    await expect(revokeAdminRoleByEmail(moderator.email, "user")).resolves.toBe(
      "not-admin",
    );
    await expect(roleOf(moderator.id)).resolves.toBe("moderator");
  });

  it("refuses to remove the last admin", async () => {
    await ensureAuthRoles();
    const userRole = await prisma.role.findUniqueOrThrow({
      where: { name: "user" },
    });
    await prisma.user.updateMany({
      where: { role: { name: "admin" } },
      data: { roleId: userRole.id },
    });
    const admin = await createTestUser("admin");

    await expect(
      revokeAdminRoleByEmail(admin.email, "moderator"),
    ).resolves.toBe("last-admin");
    await expect(roleOf(admin.id)).resolves.toBe("admin");
  });
});
