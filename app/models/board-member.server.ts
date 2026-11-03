import type { BoardMember } from "#prisma/generated/client";

import { prisma } from "~/db.server";
import {
  IMAGE_METADATA_SELECT,
  releaseImagesIfUnreferenced,
  type ImageCreateData,
  type ImageMetadata,
} from "~/models/image.server";

export type { BoardMember };

export interface BoardMemberData {
  name: string;
  position: string;
  bio?: string;
  image?: ImageCreateData;
}

export async function countBoardMembers(): Promise<number> {
  return prisma.boardMember.count();
}

export async function listBoardMembers(): Promise<
  {
    id: string;
    name: string;
    position: string;
    bio: string | null;
    image: ImageMetadata | null;
  }[]
> {
  const boardMembers = await prisma.boardMember.findMany({
    // the public hall of fame renders this list as-is, so the order has to be
    // deterministic rather than whatever the engine happens to return
    orderBy: [{ createdAt: "asc" }, { name: "asc" }],
    include: { image: { select: IMAGE_METADATA_SELECT } },
  });

  return boardMembers.map(({ id, name, position, bio, image }) => ({
    id,
    name,
    position,
    bio,
    image,
  }));
}

export async function getBoardMemberById(
  id: string,
): Promise<BoardMember | null> {
  return prisma.boardMember.findUnique({ where: { id } });
}

export async function createBoardMember(
  data: BoardMemberData,
): Promise<BoardMember> {
  const { name, position, bio, image } = data;

  return prisma.boardMember.create({
    data: {
      name,
      position,
      bio: bio || null,
      ...(image && { image: { create: image } }),
    },
  });
}

export async function deleteBoardMember(
  id: string,
): Promise<{ boardMember: BoardMember; imageKey: string | null }> {
  return prisma.$transaction(async (tx) => {
    const boardMember = await tx.boardMember.delete({ where: { id } });

    // released only after the member is gone, so the portrait survives when
    // a gallery still shows it
    let imageKey: string | null = null;
    if (boardMember.imageId) {
      const { storageKeys } = await releaseImagesIfUnreferenced(tx, [
        boardMember.imageId,
      ]);
      imageKey = storageKeys[0] ?? null;
    }

    return { boardMember, imageKey };
  });
}

export async function updateBoardMember(
  id: string,
  data: BoardMemberData,
): Promise<{ boardMember: BoardMember; replacedImageKey: string | null }> {
  const { name, position, bio, image } = data;

  return prisma.$transaction(async (tx) => {
    let previousImageId: string | null = null;

    if (image) {
      const current = await tx.boardMember.findUnique({
        where: { id },
        select: { imageId: true },
      });
      previousImageId = current?.imageId ?? null;
    }

    const boardMember = await tx.boardMember.update({
      where: { id },
      data: {
        name,
        position,
        bio: bio || null,
        ...(image && { image: { create: image } }),
      },
    });

    let replacedImageKey: string | null = null;
    if (previousImageId) {
      const { storageKeys } = await releaseImagesIfUnreferenced(tx, [
        previousImageId,
      ]);
      replacedImageKey = storageKeys[0] ?? null;
    }

    return { boardMember, replacedImageKey };
  });
}
