import type { EventGalleryImage, Prisma } from "#prisma/generated/client";

import { prisma } from "~/db.server";
import {
  IMAGE_METADATA_SELECT,
  releaseImagesIfUnreferenced,
  type ImageCreateData,
  type ImageMetadata,
} from "~/models/image.server";

export type { EventGalleryImage };

/** The event an entry hangs in, as much as the gallery reads of it. */
export interface GalleryEntryEvent {
  id: string;
  title: string;
  date: Date;
}

/** An event reference thin enough for the reuse labels. */
export interface GalleryEventLabel {
  id: string;
  title: string;
}

export interface GalleryEntry {
  /** the membership id — what the admin UI removes, never the image id */
  id: string;
  caption: string | null;
  position: number;
  /** lives on the image row; callers fall back to the event title */
  altText: string | null;
  image: ImageMetadata;
  event: GalleryEntryEvent;
}

export interface GalleryEntryWithReuse extends GalleryEntry {
  /** the other events whose gallery shows the very same image */
  sharedWith: GalleryEventLabel[];
}

/** One dinner's gallery as the index lists it — cover, count, no photos. */
export interface GalleryAlbum {
  id: string;
  title: string;
  /** the dinner's own description, used as the album's opening paragraph */
  description: string;
  date: Date;
  imageCount: number;
  cover: (ImageMetadata & { altText: string | null }) | null;
}

/** Image scalars plus the metadata the entry itself does not carry. */
export type GalleryImageCreateData = ImageCreateData & {
  altText?: string | null;
  caption?: string | null;
};

export interface RemovedGalleryEntry {
  imageId: string;
  /** set iff the unlink released the image — destroy the provider asset */
  deletedStorageKey: string | null;
}

const ENTRY_SELECT = {
  id: true,
  caption: true,
  position: true,
  image: { select: { ...IMAGE_METADATA_SELECT, altText: true } },
  event: { select: { id: true, title: true, date: true } },
} satisfies Prisma.EventGalleryImageSelect;

const ENTRY_WITH_REUSE_SELECT = {
  ...ENTRY_SELECT,
  image: {
    select: {
      ...IMAGE_METADATA_SELECT,
      altText: true,
      galleryLinks: {
        select: { eventId: true, event: { select: { id: true, title: true } } },
      },
    },
  },
} satisfies Prisma.EventGalleryImageSelect;

// newest event first, then the event's own display order
const ENTRY_ORDER_BY = [
  { event: { date: "desc" } },
  { position: "asc" },
] satisfies Prisma.EventGalleryImageOrderByWithRelationInput[];

type EntryRow = Prisma.EventGalleryImageGetPayload<{
  select: typeof ENTRY_SELECT;
}>;
type EntryWithReuseRow = Prisma.EventGalleryImageGetPayload<{
  select: typeof ENTRY_WITH_REUSE_SELECT;
}>;

function toGalleryEntry(row: EntryRow): GalleryEntry {
  const { altText, ...image } = row.image;

  return {
    id: row.id,
    caption: row.caption,
    position: row.position,
    altText,
    image,
    event: row.event,
  };
}

function toGalleryEntryWithReuse(
  row: EntryWithReuseRow,
): GalleryEntryWithReuse {
  const { altText, galleryLinks, ...image } = row.image;

  return {
    id: row.id,
    caption: row.caption,
    position: row.position,
    altText,
    image,
    event: row.event,
    sharedWith: galleryLinks
      .filter((entry) => entry.eventId !== row.event.id)
      .map((entry) => entry.event),
  };
}

async function nextPositionInTx(
  tx: Prisma.TransactionClient,
  eventId: string,
): Promise<number> {
  const { _max } = await tx.eventGalleryImage.aggregate({
    where: { eventId },
    _max: { position: true },
  });

  return (_max.position ?? -1) + 1;
}

/**
 * Every membership hanging in an event that already happened, newest event
 * first. Upcoming events keep their photos to their own page — the same cut
 * `isPastEvent` makes: strictly before `now`.
 */
export async function getGalleryEntries(now: Date): Promise<GalleryEntry[]> {
  const entries = await prisma.eventGalleryImage.findMany({
    where: { event: { date: { lt: now } } },
    select: ENTRY_SELECT,
    orderBy: ENTRY_ORDER_BY,
  });

  return entries.map(toGalleryEntry);
}

/**
 * The dinners the gallery index lists: past ones that actually hold photos,
 * newest first. A dinner with an empty gallery is omitted rather than shown
 * as an empty room.
 */
export async function getGalleryAlbums(now: Date): Promise<GalleryAlbum[]> {
  const events = await prisma.event.findMany({
    where: {
      date: { lt: now },
      galleryImages: { some: {} },
    },
    orderBy: { date: "desc" },
    select: {
      id: true,
      title: true,
      description: true,
      date: true,
      _count: { select: { galleryImages: true } },
      // the first photo in display order stands in as the album cover, so the
      // index reflects what the admin actually ordered
      galleryImages: {
        orderBy: { position: "asc" },
        take: 1,
        select: {
          image: { select: { ...IMAGE_METADATA_SELECT, altText: true } },
        },
      },
    },
  });

  return events.map((event) => {
    const cover = event.galleryImages.at(0)?.image ?? null;

    return {
      id: event.id,
      title: event.title,
      description: event.description,
      date: event.date,
      imageCount: event._count.galleryImages,
      cover: cover ? { ...cover, altText: cover.altText } : null,
    };
  });
}

/** One event's memberships in display order — the public page's read. */
export async function getGalleryEntriesForEvent(
  eventId: string,
): Promise<GalleryEntry[]> {
  const entries = await prisma.eventGalleryImage.findMany({
    where: { eventId },
    select: ENTRY_SELECT,
    orderBy: { position: "asc" },
  });

  return entries.map(toGalleryEntry);
}

/** The admin read: each entry plus the other events showing its image. */
export async function getGalleryEntriesForEventWithReuse(
  eventId: string,
): Promise<GalleryEntryWithReuse[]> {
  const entries = await prisma.eventGalleryImage.findMany({
    where: { eventId },
    select: ENTRY_WITH_REUSE_SELECT,
    orderBy: { position: "asc" },
  });

  return entries.map(toGalleryEntryWithReuse);
}

/**
 * Upload path: persist freshly stored images and grant each one membership in
 * this event, appending after the current last entry. One transaction, so a
 * failed entry write cannot leave an image row nothing points at.
 */
export async function createGalleryImagesForEvent(
  eventId: string,
  images: GalleryImageCreateData[],
): Promise<EventGalleryImage[]> {
  if (images.length === 0) return [];

  return prisma.$transaction(async (tx) => {
    let position = await nextPositionInTx(tx, eventId);
    const entries: EventGalleryImage[] = [];

    for (const { altText, caption, ...image } of images) {
      const created = await tx.image.create({
        data: { ...image, altText: altText ?? null },
      });

      entries.push(
        await tx.eventGalleryImage.create({
          data: {
            eventId,
            imageId: created.id,
            caption: caption ?? null,
            position: position++,
          },
        }),
      );
    }

    return entries;
  });
}

/**
 * Unlink one image from one event, scoped to that event — an entry hanging
 * elsewhere reads as not found. An image still referenced anywhere (another
 * gallery, a cover or portrait slot) survives the unlink; only the last
 * unlink deletes the row, and its storageKey comes back for the caller's
 * post-commit provider destroy.
 */
export async function removeGalleryEntry(
  eventId: string,
  entryId: string,
): Promise<RemovedGalleryEntry | null> {
  return prisma.$transaction(async (tx) => {
    const entry = await tx.eventGalleryImage.findFirst({
      where: { id: entryId, eventId },
      select: { imageId: true },
    });
    if (!entry) return null;

    await tx.eventGalleryImage.delete({ where: { id: entryId } });
    const { storageKeys } = await releaseImagesIfUnreferenced(tx, [
      entry.imageId,
    ]);

    return {
      imageId: entry.imageId,
      deletedStorageKey: storageKeys[0] ?? null,
    };
  });
}
