import { faker } from "@faker-js/faker";
import { afterEach, describe, expect, it } from "vitest";

import { buildEventData } from "../../test/factories";

import { deleteBoardMember, updateBoardMember } from "./board-member.server";
import {
  createEvent,
  deleteEvent,
  deleteEventsInTx,
  updateEvent,
} from "./event.server";
import {
  createGalleryImagesForEvent,
  getGalleryEntries,
  getGalleryEntriesForEvent,
  getGalleryEntriesForEventWithReuse,
  removeGalleryEntry,
  reorderGalleryEntries,
  type GalleryImageCreateData,
} from "./gallery.server";

import { prisma } from "~/db.server";

// every row this file creates is reachable from one of these
const GALLERY_KEY_PREFIX = "test/event-gallery/";
const eventIds: string[] = [];
const boardMemberIds: string[] = [];

function buildGalleryImage(
  overrides: Partial<GalleryImageCreateData> = {},
): GalleryImageCreateData {
  return {
    contentType: "image/jpeg",
    storageKey: `${GALLERY_KEY_PREFIX}${faker.string.uuid()}`,
    ...overrides,
  };
}

async function createTestEvent(date?: Date) {
  const event = await createEvent({
    ...(await buildEventData()),
    ...(date && { date }),
  });
  eventIds.push(event.id);
  return event;
}

/** One uploaded image in one event's gallery — the common starting point. */
async function uploadOne(eventId: string, caption?: string) {
  const data = buildGalleryImage(caption ? { caption } : {});
  const [entry] = await createGalleryImagesForEvent(eventId, [data]);
  return { entry, data };
}

/** Hangs an existing image in a second event, appending to that gallery. */
async function hangAlsoIn(eventId: string, imageId: string) {
  const position = await prisma.eventGalleryImage.count({ where: { eventId } });
  return prisma.eventGalleryImage.create({
    data: { eventId, imageId, position },
  });
}

afterEach(async () => {
  const ids = eventIds.splice(0);
  if (ids.length > 0) {
    // takes the events' entries and cover images with them
    await prisma.$transaction((tx) =>
      deleteEventsInTx(tx, { id: { in: ids } }),
    );
  }
  await prisma.image.deleteMany({
    where: { storageKey: { startsWith: GALLERY_KEY_PREFIX } },
  });
  const members = boardMemberIds.splice(0);
  if (members.length > 0) {
    await prisma.boardMember.deleteMany({ where: { id: { in: members } } });
  }
});

describe("createGalleryImagesForEvent", () => {
  it("creates the image row and its membership together", async () => {
    const event = await createTestEvent();
    const data = buildGalleryImage({ caption: "Plating the first course" });

    const [entry] = await createGalleryImagesForEvent(event.id, [data]);

    expect(entry).toMatchObject({ eventId: event.id, position: 0 });
    const image = await prisma.image.findUniqueOrThrow({
      where: { id: entry.imageId },
      include: { event: true, boardMember: true },
    });
    expect(image.storageKey).toBe(data.storageKey);
    // the image stays ownerless — the entry, not a slot, ties it to an event
    expect(image.event).toBeNull();
    expect(image.boardMember).toBeNull();

    const [read] = await getGalleryEntriesForEventWithReuse(event.id);
    expect(read).toMatchObject({
      id: entry.id,
      caption: "Plating the first course",
      image: { id: entry.imageId, storageKey: data.storageKey },
      event: { id: event.id, title: event.title },
      sharedWith: [],
    });
  });

  it("appends after the current last position", async () => {
    const event = await createTestEvent();

    await createGalleryImagesForEvent(event.id, [
      buildGalleryImage(),
      buildGalleryImage(),
    ]);
    await createGalleryImagesForEvent(event.id, [buildGalleryImage()]);

    const entries = await getGalleryEntriesForEvent(event.id);
    expect(entries.map((entry) => entry.position)).toEqual([0, 1, 2]);
  });

  it("leaves no image row when the entry write fails", async () => {
    const data = buildGalleryImage();

    await expect(
      createGalleryImagesForEvent("does-not-exist", [data]),
    ).rejects.toThrow();

    await expect(
      prisma.image.count({ where: { storageKey: data.storageKey } }),
    ).resolves.toBe(0);
  });
});

describe("getGalleryEntriesForEventWithReuse", () => {
  it("names the other events showing the same image", async () => {
    const [first, second] = await Promise.all([
      createTestEvent(),
      createTestEvent(),
    ]);
    const { entry } = await uploadOne(first.id, "As served");
    await hangAlsoIn(second.id, entry.imageId);

    const [firstEntry] = await getGalleryEntriesForEventWithReuse(first.id);
    const [secondEntry] = await getGalleryEntriesForEventWithReuse(second.id);

    expect(firstEntry.caption).toBe("As served");
    // the caption lives on the membership, so the same photo reads differently
    expect(secondEntry.caption).toBeNull();
    expect(firstEntry.sharedWith).toEqual([
      { id: second.id, title: second.title },
    ]);
    expect(secondEntry.sharedWith).toEqual([
      { id: first.id, title: first.title },
    ]);
  });
});

describe("removeGalleryEntry", () => {
  it("unlinks one event, leaving the image and the other event intact", async () => {
    const [first, second] = await Promise.all([
      createTestEvent(),
      createTestEvent(),
    ]);
    const { entry } = await uploadOne(first.id);
    await hangAlsoIn(second.id, entry.imageId);

    const removed = await removeGalleryEntry(first.id, entry.id);

    expect(removed).toEqual({
      imageId: entry.imageId,
      // still hanging in the second event — destroying it would be the bug
      deletedStorageKey: null,
    });
    await expect(getGalleryEntriesForEvent(first.id)).resolves.toEqual([]);
    await expect(getGalleryEntriesForEvent(second.id)).resolves.toHaveLength(1);
    await expect(
      prisma.image.findUnique({ where: { id: entry.imageId } }),
    ).resolves.not.toBeNull();
  });

  it("deletes the image with the last membership", async () => {
    const event = await createTestEvent();
    const { entry, data } = await uploadOne(event.id);

    const removed = await removeGalleryEntry(event.id, entry.id);

    expect(removed).toEqual({
      imageId: entry.imageId,
      // nothing references the image anymore — the caller destroys the asset
      deletedStorageKey: data.storageKey,
    });
    await expect(
      prisma.image.findUnique({ where: { id: entry.imageId } }),
    ).resolves.toBeNull();
  });

  it("keeps an image another slot owns", async () => {
    const event = await createTestEvent();
    const portrait = await prisma.image.create({ data: buildGalleryImage() });
    const member = await prisma.boardMember.create({
      data: {
        name: faker.person.fullName(),
        position: "Cook",
        image: { connect: { id: portrait.id } },
      },
    });
    boardMemberIds.push(member.id);
    // built directly: no model write hangs an already-stored image in a gallery
    const entry = await prisma.eventGalleryImage.create({
      data: { eventId: event.id, imageId: portrait.id, position: 0 },
    });

    const removed = await removeGalleryEntry(event.id, entry.id);

    expect(removed?.deletedStorageKey).toBeNull();
    await expect(
      prisma.image.findUnique({ where: { id: portrait.id } }),
    ).resolves.not.toBeNull();
  });

  it("does not reach an entry through another event's id", async () => {
    const [first, second] = await Promise.all([
      createTestEvent(),
      createTestEvent(),
    ]);
    const { entry } = await uploadOne(first.id);

    await expect(removeGalleryEntry(second.id, entry.id)).resolves.toBeNull();
    await expect(getGalleryEntriesForEvent(first.id)).resolves.toHaveLength(1);
  });

  it("returns null for an entry that is already gone", async () => {
    const event = await createTestEvent();

    await expect(
      removeGalleryEntry(event.id, "does-not-exist"),
    ).resolves.toBeNull();
  });
});

describe("reorderGalleryEntries", () => {
  async function eventWithThree() {
    const event = await createTestEvent();
    await createGalleryImagesForEvent(event.id, [
      buildGalleryImage(),
      buildGalleryImage(),
      buildGalleryImage(),
    ]);
    const ids = (await getGalleryEntriesForEvent(event.id)).map(
      (entry) => entry.id,
    );
    return { event, ids };
  }

  it("hangs the entries in the order given", async () => {
    const { event, ids } = await eventWithThree();
    const [a, b, c] = ids;

    expect(await reorderGalleryEntries(event.id, [c, a, b])).toBe(true);

    const entries = await getGalleryEntriesForEvent(event.id);
    expect(entries.map((entry) => entry.id)).toEqual([c, a, b]);
    expect(entries.map((entry) => entry.position)).toEqual([0, 1, 2]);
  });

  it("leaves the order alone when the list misses an entry", async () => {
    const { event, ids } = await eventWithThree();
    const [a, b, c] = ids;

    expect(await reorderGalleryEntries(event.id, [c, a])).toBe(false);
    expect(await reorderGalleryEntries(event.id, [c, a, a])).toBe(false);

    const entries = await getGalleryEntriesForEvent(event.id);
    expect(entries.map((entry) => entry.id)).toEqual([a, b, c]);
  });

  it("does not move another event's entries", async () => {
    const first = await eventWithThree();
    const second = await eventWithThree();

    expect(
      await reorderGalleryEntries(first.event.id, [
        second.ids[2],
        second.ids[1],
        second.ids[0],
      ]),
    ).toBe(false);

    const entries = await getGalleryEntriesForEvent(second.event.id);
    expect(entries.map((entry) => entry.id)).toEqual(second.ids);
  });
});

describe("deleting an event", () => {
  it("cascades its entries but keeps the shared image and the other event", async () => {
    const [first, second] = await Promise.all([
      createTestEvent(),
      createTestEvent(),
    ]);
    const { entry, data } = await uploadOne(first.id);
    await hangAlsoIn(second.id, entry.imageId);

    const { imageKeys } = await deleteEvent(first.id);
    eventIds.splice(eventIds.indexOf(first.id), 1);

    expect(imageKeys).not.toContain(data.storageKey);
    await expect(
      prisma.eventGalleryImage.findUnique({ where: { id: entry.id } }),
    ).resolves.toBeNull();
    await expect(
      prisma.image.findUnique({ where: { id: entry.imageId } }),
    ).resolves.not.toBeNull();
    await expect(getGalleryEntriesForEvent(second.id)).resolves.toHaveLength(1);
  });

  it("releases an image only its own gallery showed", async () => {
    const event = await createTestEvent();
    const { entry, data } = await uploadOne(event.id);

    const { imageKeys } = await deleteEvent(event.id);
    eventIds.splice(eventIds.indexOf(event.id), 1);

    expect(imageKeys).toContain(data.storageKey);
    await expect(
      prisma.image.findUnique({ where: { id: entry.imageId } }),
    ).resolves.toBeNull();
  });
});

describe("slot images hanging in galleries", () => {
  /** An event whose cover also hangs in another event's gallery. */
  async function coverLinkedElsewhere() {
    const [event, other] = await Promise.all([
      createTestEvent(),
      createTestEvent(),
    ]);
    const coverId = event.imageId;
    if (!coverId) throw new Error(`Expected a cover for event ${event.id}`);
    // built directly: no model write hangs an already-stored image in a gallery
    await prisma.eventGalleryImage.create({
      data: { eventId: other.id, imageId: coverId, position: 0 },
    });
    return { event, coverId };
  }

  /** A board member whose portrait also hangs in an event's gallery. */
  async function portraitLinkedElsewhere() {
    const event = await createTestEvent();
    const portrait = await prisma.image.create({ data: buildGalleryImage() });
    const member = await prisma.boardMember.create({
      data: {
        name: faker.person.fullName(),
        position: "Cook",
        image: { connect: { id: portrait.id } },
      },
    });
    boardMemberIds.push(member.id);
    await prisma.eventGalleryImage.create({
      data: { eventId: event.id, imageId: portrait.id, position: 0 },
    });
    return { member, portraitId: portrait.id };
  }

  it("replacing an event's cover keeps the old cover a gallery shows", async () => {
    const { event, coverId } = await coverLinkedElsewhere();

    const { replacedImageKey } = await updateEvent(event.id, {
      image: buildGalleryImage(),
    });

    expect(replacedImageKey).toBeNull();
    await expect(
      prisma.image.findUnique({ where: { id: coverId } }),
    ).resolves.not.toBeNull();
  });

  it("deleting an event keeps the cover a gallery shows", async () => {
    const { event, coverId } = await coverLinkedElsewhere();

    const { imageKeys } = await deleteEvent(event.id);
    eventIds.splice(eventIds.indexOf(event.id), 1);

    expect(imageKeys).toEqual([]);
    await expect(
      prisma.image.findUnique({ where: { id: coverId } }),
    ).resolves.not.toBeNull();
  });

  it("replacing a board member's portrait keeps the old one a gallery shows", async () => {
    const { member, portraitId } = await portraitLinkedElsewhere();

    const { replacedImageKey } = await updateBoardMember(member.id, {
      name: member.name,
      position: member.position,
      image: buildGalleryImage(),
    });

    expect(replacedImageKey).toBeNull();
    await expect(
      prisma.image.findUnique({ where: { id: portraitId } }),
    ).resolves.not.toBeNull();
  });

  it("deleting a board member keeps the portrait a gallery shows", async () => {
    const { member, portraitId } = await portraitLinkedElsewhere();

    const { imageKey } = await deleteBoardMember(member.id);

    expect(imageKey).toBeNull();
    await expect(
      prisma.image.findUnique({ where: { id: portraitId } }),
    ).resolves.not.toBeNull();
  });
});

describe("read projections", () => {
  const NOW = new Date("2200-06-01T00:00:00.000Z");

  it("orders every entry newest event first, then display order", async () => {
    const older = await createTestEvent(new Date("2200-01-01T18:00:00.000Z"));
    const newer = await createTestEvent(new Date("2200-02-01T18:00:00.000Z"));
    await createGalleryImagesForEvent(older.id, [
      buildGalleryImage(),
      buildGalleryImage(),
    ]);
    await createGalleryImagesForEvent(newer.id, [buildGalleryImage()]);

    const mine = (await getGalleryEntries(NOW)).filter((entry) =>
      [older.id, newer.id].includes(entry.event.id),
    );

    expect(mine.map((entry) => [entry.event.id, entry.position])).toEqual([
      [newer.id, 0],
      [older.id, 0],
      [older.id, 1],
    ]);
  });

  it("leaves an upcoming event's photos out of the app-wide listing", async () => {
    const upcoming = await createTestEvent(
      new Date("2200-07-01T18:00:00.000Z"),
    );
    const { entry } = await uploadOne(upcoming.id);

    const listed = await getGalleryEntries(NOW);

    expect(listed.some((listedEntry) => listedEntry.id === entry.id)).toBe(
      false,
    );
    // the event's own page still shows them once the evening has happened
    await expect(getGalleryEntriesForEvent(upcoming.id)).resolves.toHaveLength(
      1,
    );
  });

  it("lists an event that has only just happened", async () => {
    const event = await createTestEvent(new Date(NOW.getTime() - 1));
    const { entry } = await uploadOne(event.id);

    const listed = await getGalleryEntries(NOW);

    expect(listed.some((listedEntry) => listedEntry.id === entry.id)).toBe(
      true,
    );
  });
});
