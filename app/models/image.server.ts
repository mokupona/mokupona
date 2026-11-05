import type { Image, Prisma } from "#prisma/generated/client";

import { prisma } from "~/db.server";
import {
  cropColumns,
  type ImageCrop,
  type ImageCropColumns,
} from "~/shared/image-crop";

export type { Image };

/** What showing an image takes; the crop columns are its admin framing. */
export interface ImageMetadata extends ImageCropColumns {
  id: string;
  storageKey: string;
  version: number | null;
  width: number | null;
  height: number | null;
  blurDataUrl: string | null;
}

export const IMAGE_METADATA_SELECT = {
  id: true,
  storageKey: true,
  version: true,
  width: true,
  height: true,
  blurDataUrl: true,
  cropX: true,
  cropY: true,
  cropWidth: true,
  cropHeight: true,
} satisfies Prisma.ImageSelect;

export interface ImageCreateData extends ImageCropColumns {
  contentType: string;
  storageKey: string;
  version?: number | null;
  width?: number | null;
  height?: number | null;
  blurDataUrl?: string | null;
}

export async function getImageById(id: string): Promise<Image | null> {
  return prisma.image.findUnique({ where: { id } });
}

/**
 * Sets (or with null, clears) an image's framing. `size` fills in the
 * dimensions of a row stored before they were recorded, which a crop needs
 * to be cut in pixels; dimensions already stored are left alone.
 */
export async function setImageCrop(
  id: string,
  crop: ImageCrop | null,
  size?: { width: number; height: number },
) {
  const image = await prisma.image.findUnique({
    where: { id },
    select: { width: true, height: true },
  });
  if (!image) return null;

  const backfill =
    size && (!image.width || !image.height)
      ? { width: size.width, height: size.height }
      : {};

  return prisma.image.update({
    where: { id },
    data: { ...cropColumns(crop), ...backfill },
    select: IMAGE_METADATA_SELECT,
  });
}

/**
 * Every `Image` relation that counts as the image being in use, each paired
 * with the where-fragment matching images unused at that site. The cleanup
 * logic derives from this one list; the completeness test in
 * image.server.test.ts fails when the schema grows a relation to `Image`
 * this registry does not know about.
 */
export const IMAGE_REFERENCE_SITES = {
  event: { event: null },
  boardMember: { boardMember: null },
  volunteer: { volunteer: null },
  galleryLinks: { galleryLinks: { none: {} } },
} as const satisfies Record<string, Prisma.ImageWhereInput>;

// Models-internal plumbing: matches images no reference site points at —
// the precondition for destroying an asset.
export const UNREFERENCED_IMAGE_WHERE: Prisma.ImageWhereInput = {
  AND: Object.values(IMAGE_REFERENCE_SITES),
};

// Matches images no slot claims — not an event cover, not a board or
// volunteer portrait.
// Gallery membership does not count: the reuse pool and the seed treat
// slot-owned images as off limits whether or not a gallery shows them.
export const UNOWNED_IMAGE_WHERE: Prisma.ImageWhereInput = {
  AND: [
    IMAGE_REFERENCE_SITES.event,
    IMAGE_REFERENCE_SITES.boardMember,
    IMAGE_REFERENCE_SITES.volunteer,
  ],
};

/**
 * Delete-on-last-unlink, enforced: of the given images, delete those no
 * reference site points at anymore. Rows fall inside the caller's
 * transaction; the returned storageKeys are the caller's to destroy at the
 * provider after commit. Images something still references survive untouched.
 */
export async function releaseImagesIfUnreferenced(
  tx: Prisma.TransactionClient,
  imageIds: string[],
): Promise<{ deletedIds: string[]; storageKeys: string[] }> {
  const ids = [...new Set(imageIds)];
  if (ids.length === 0) return { deletedIds: [], storageKeys: [] };

  const unreferenced = await tx.image.findMany({
    where: { id: { in: ids }, ...UNREFERENCED_IMAGE_WHERE },
    select: { id: true, storageKey: true },
  });
  if (unreferenced.length === 0) return { deletedIds: [], storageKeys: [] };

  const deletedIds = unreferenced.map((image) => image.id);
  await tx.image.deleteMany({ where: { id: { in: deletedIds } } });

  return {
    deletedIds,
    storageKeys: unreferenced.map((image) => image.storageKey),
  };
}
