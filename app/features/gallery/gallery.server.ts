import type { GalleryAlbumModel, GalleryImageModel } from "./view-models";

import {
  getGalleryAlbums,
  getGalleryEntries,
  getGalleryEntriesForEvent,
  type GalleryAlbum,
  type GalleryEntry,
} from "~/models/gallery.server";

function toGalleryAlbumModel(album: GalleryAlbum): GalleryAlbumModel {
  // altText lives on the image row but is an album-level concern here, so it
  // is lifted off the metadata rather than passed down to the <img>.
  let cover: GalleryAlbumModel["cover"] = null;
  let coverAlt = album.title;

  if (album.cover) {
    const { altText, ...image } = album.cover;
    cover = image;
    coverAlt = altText?.trim() || album.title;
  }

  return {
    id: album.id,
    title: album.title,
    description: album.description,
    date: album.date,
    imageCount: album.imageCount,
    cover,
    coverAlt,
  };
}

function toGalleryImageModel(entry: GalleryEntry): GalleryImageModel {
  return {
    // the membership, not the image: the same photo can hold several
    id: entry.id,
    image: entry.image,
    alt: entry.altText?.trim() || entry.event.title,
    caption: entry.caption,
    event: entry.event,
  };
}

/**
 * Every gallery image from an event that already happened — newest event
 * first, then display order. An upcoming event's photos stay unlisted here
 * for the same reason its own page hides them.
 */
export async function listGalleryImages(
  now: Date = new Date(),
): Promise<GalleryImageModel[]> {
  return (await getGalleryEntries(now)).map(toGalleryImageModel);
}

/** One event's gallery, in display order. */
export async function listGalleryImagesForEvent(
  eventId: string,
): Promise<GalleryImageModel[]> {
  return (await getGalleryEntriesForEvent(eventId)).map(toGalleryImageModel);
}

/**
 * The gallery index: one album per past dinner that has photos, newest first.
 */
export async function listGalleryAlbums(
  now: Date = new Date(),
): Promise<GalleryAlbumModel[]> {
  return (await getGalleryAlbums(now)).map(toGalleryAlbumModel);
}
