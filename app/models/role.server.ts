import type { Role } from "#prisma/generated/client";

import { prisma } from "~/db.server";

export type { Role };

export async function getRoleByName(name: string): Promise<Role | null> {
  return prisma.role.findUnique({ where: { name } });
}

/** Create whichever of the named roles are missing; existing ones are kept. */
export async function ensureRoles(names: readonly string[]): Promise<void> {
  for (const name of names) {
    await prisma.role.upsert({ where: { name }, create: { name }, update: {} });
  }
}
