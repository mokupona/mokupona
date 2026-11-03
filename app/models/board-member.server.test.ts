import { faker } from "@faker-js/faker";
import { describe, expect, it } from "vitest";

import {
  createBoardMember,
  deleteBoardMember,
  updateBoardMember,
} from "./board-member.server";

import { prisma } from "~/db.server";
import type { ImageCreateData } from "~/models/image.server";

function portrait(marker: string): ImageCreateData {
  return {
    contentType: "image/jpeg",
    storageKey: `test/board-members/${marker}-${faker.string.uuid()}`,
  };
}

/** The member's portrait row, joined via BoardMember.imageId. */
async function findPortrait(memberId: string) {
  const member = await prisma.boardMember.findUnique({
    where: { id: memberId },
    select: { image: true },
  });
  return member?.image ?? null;
}

async function findPortraitOrThrow(memberId: string) {
  const image = await findPortrait(memberId);
  if (!image) throw new Error(`Expected a portrait for member ${memberId}`);
  return image;
}

describe("board member image lifecycle", () => {
  it("creates the portrait with the member", async () => {
    const member = await createBoardMember({
      name: "With Portrait",
      position: "Test Position",
      image: portrait("create-portrait"),
    });

    await expect(
      prisma.image.count({ where: { boardMember: { id: member.id } } }),
    ).resolves.toBe(1);
  });

  it("replaces the portrait on update: old row deleted, new row created", async () => {
    const member = await createBoardMember({
      name: "Swap Portrait",
      position: "Test Position",
      image: portrait("old-portrait"),
    });
    const oldImage = await findPortraitOrThrow(member.id);

    await updateBoardMember(member.id, {
      name: member.name,
      position: member.position,
      image: portrait("new-portrait"),
    });

    await expect(
      prisma.image.findUnique({ where: { id: oldImage.id } }),
    ).resolves.toBeNull();
    await expect(
      prisma.image.count({ where: { boardMember: { id: member.id } } }),
    ).resolves.toBe(1);
  });

  it("keeps the portrait when updating without an image", async () => {
    const member = await createBoardMember({
      name: "Keep Portrait",
      position: "Test Position",
      image: portrait("kept-portrait"),
    });
    const image = await findPortraitOrThrow(member.id);

    await updateBoardMember(member.id, {
      name: "Renamed",
      position: member.position,
    });

    await expect(
      prisma.image.findUnique({ where: { id: image.id } }),
    ).resolves.not.toBeNull();
  });

  it("deletes the portrait image row with the member", async () => {
    const member = await createBoardMember({
      name: "Delete Portrait",
      position: "Test Position",
      image: portrait("deleted-portrait"),
    });
    const image = await findPortraitOrThrow(member.id);

    await deleteBoardMember(member.id);

    await expect(
      prisma.image.findUnique({ where: { id: image.id } }),
    ).resolves.toBeNull();
  });

  it("deleteBoardMember returns the captured portrait storageKey", async () => {
    const image = portrait("captured-on-delete");
    const member = await createBoardMember({
      name: "Capture Delete",
      position: "Test Position",
      image,
    });

    const result = await deleteBoardMember(member.id);

    expect(result.boardMember.id).toBe(member.id);
    expect(result.imageKey).toBe(image.storageKey);
  });

  it("deleteBoardMember returns a null key for a portraitless member", async () => {
    const member = await createBoardMember({
      name: "No Portrait",
      position: "Test Position",
    });

    const result = await deleteBoardMember(member.id);

    expect(result.imageKey).toBeNull();
  });

  it("updateBoardMember returns the replaced portrait's storageKey on a swap", async () => {
    const oldImage = portrait("captured-on-swap");
    const member = await createBoardMember({
      name: "Capture Swap",
      position: "Test Position",
      image: oldImage,
    });

    const result = await updateBoardMember(member.id, {
      name: member.name,
      position: member.position,
      image: portrait("swap-replacement"),
    });

    expect(result.replacedImageKey).toBe(oldImage.storageKey);
  });

  it("updateBoardMember returns a null key when the portrait is untouched", async () => {
    const member = await createBoardMember({
      name: "Keep On Update",
      position: "Test Position",
      image: portrait("kept-on-update"),
    });

    const result = await updateBoardMember(member.id, {
      name: "Renamed Again",
      position: member.position,
    });

    expect(result.replacedImageKey).toBeNull();
  });
});

describe("board member bio", () => {
  it("saves a bio and clears it when updated with an empty one", async () => {
    const member = await createBoardMember({
      name: "With Bio",
      position: "Test Position",
      bio: "Folds dumplings.",
    });
    expect(member.bio).toBe("Folds dumplings.");

    const { boardMember } = await updateBoardMember(member.id, {
      name: member.name,
      position: member.position,
      bio: "",
    });

    expect(boardMember.bio).toBeNull();
  });
});
