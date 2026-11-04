import { prisma } from "~/db.server";

export interface StoredSiteText {
  key: string;
  value: string;
  defaultAtEdit: string;
  updatedAt: Date;
}

export async function listSiteTexts(): Promise<StoredSiteText[]> {
  return prisma.siteText.findMany({
    orderBy: { key: "asc" },
    select: { key: true, value: true, defaultAtEdit: true, updatedAt: true },
  });
}

/**
 * Stores edits and drops the edits that went back to the default, in one
 * transaction so a half-saved section can't happen.
 */
export async function saveSiteTexts({
  upserts,
  removals,
}: {
  upserts: { key: string; value: string; defaultAtEdit: string }[];
  removals: string[];
}): Promise<void> {
  await prisma.$transaction([
    ...upserts.map(({ key, value, defaultAtEdit }) =>
      prisma.siteText.upsert({
        where: { key },
        create: { key, value, defaultAtEdit },
        update: { value, defaultAtEdit },
      }),
    ),
    prisma.siteText.deleteMany({ where: { key: { in: removals } } }),
  ]);
}
