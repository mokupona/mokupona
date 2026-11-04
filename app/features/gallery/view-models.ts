// Client-safe: the render-ready shape gallery rows are mapped into (see
// app/features/gallery/gallery.server.ts), so the layout never learns which
// tables produced them.

import type { SerializableDate } from "~/features/events/view-models";
import type { ImageMetadata } from "~/models/image.server";

/** The event a gallery image belongs to, as much as a layout needs of it. */
export interface GalleryEventRef {
  id: string;
  title: string;
  date: SerializableDate;
}

/** A dinner's gallery as the index lists it — no photos, just the way in. */
export interface GalleryAlbumModel {
  id: string;
  title: string;
  /** the dinner's own description, shown as the album's opening paragraph */
  description: string;
  date: SerializableDate;
  imageCount: number;
  cover: ImageMetadata | null;
  /** never empty — falls back to the dinner title */
  coverAlt: string;
}

export interface GalleryImageModel {
  /**
   * Entry identity — what the admin UI removes. Deliberately NOT the image
   * id: one image can hold several memberships, and removing one must not
   * touch the others.
   */
  id: string;
  image: ImageMetadata;
  /** never null — falls back to the event title */
  alt: string;
  caption: string | null;
  /** null for images no event claims */
  event: GalleryEventRef | null;
}
