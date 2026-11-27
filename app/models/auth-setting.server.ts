import { prisma } from "~/db.server";

/** The toggles an admin has switched; one nobody switched has no row. */
export async function listAuthSettingRows(): Promise<
  { toggle: string; enabled: boolean }[]
> {
  return prisma.authSetting.findMany({
    select: { toggle: true, enabled: true },
  });
}

export async function findAuthSettingRow(
  toggle: string,
): Promise<{ enabled: boolean } | null> {
  return prisma.authSetting.findUnique({
    where: { toggle },
    select: { enabled: true },
  });
}

export async function saveAuthSettingRow(
  toggle: string,
  enabled: boolean,
): Promise<void> {
  await prisma.authSetting.upsert({
    where: { toggle },
    create: { toggle, enabled },
    update: { enabled },
  });
}

export async function deleteAuthSettingRows(): Promise<void> {
  await prisma.authSetting.deleteMany();
}
