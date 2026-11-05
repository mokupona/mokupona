// The geometry behind the photo framing editor (app/components/
// admin-image-framer.tsx): a frame of a fixed shape, and the photo dragged
// and zoomed behind it. Everything is in frame-relative units, the frame
// 1 wide and 1/aspect tall, so resizing the dialog never shifts the framing.

import { clampCrop, type ImageCrop } from "./image-crop";

export const MIN_ZOOM = 1;
export const MAX_ZOOM = 4;

export interface PhotoSize {
  width: number;
  height: number;
}

export interface Offset {
  x: number;
  y: number;
}

/**
 * How far the photo is zoomed past just covering the frame, and how far its
 * centre sits from the frame's centre.
 */
export interface Framing {
  zoom: number;
  offset: Offset;
}

export const INITIAL_FRAMING: Framing = { zoom: 1, offset: { x: 0, y: 0 } };

export function clampZoom(zoom: number) {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));
}

/** The photo's size in frame units, and frame units per photo pixel. */
export function displayedSize(photo: PhotoSize, aspect: number, zoom: number) {
  const base = Math.max(1 / photo.width, 1 / aspect / photo.height);
  const scale = base * zoom;
  return { w: photo.width * scale, h: photo.height * scale, scale };
}

/** Keeps the photo covering the frame: no empty band at any edge. */
export function clampOffset(
  photo: PhotoSize,
  aspect: number,
  zoom: number,
  offset: Offset,
): Offset {
  const { w, h } = displayedSize(photo, aspect, zoom);
  const maxX = Math.max(0, (w - 1) / 2);
  const maxY = Math.max(0, (h - 1 / aspect) / 2);
  return {
    x: Math.min(maxX, Math.max(-maxX, offset.x)),
    y: Math.min(maxY, Math.max(-maxY, offset.y)),
  };
}

export function clampFraming(
  photo: PhotoSize,
  aspect: number,
  { zoom, offset }: Framing,
): Framing {
  const clamped = clampZoom(zoom);
  return { zoom: clamped, offset: clampOffset(photo, aspect, clamped, offset) };
}

/** Where the photo sits in the frame, as CSS percentages of the frame. */
export function photoPlacement(
  photo: PhotoSize,
  aspect: number,
  { zoom, offset }: Framing,
) {
  const { w, h } = displayedSize(photo, aspect, zoom);
  return {
    width: `${w * 100}%`,
    left: `${(0.5 + offset.x - w / 2) * 100}%`,
    // top is a percentage of the frame's height, which is 1/aspect
    top: `${(0.5 + (offset.y - h / 2) * aspect) * 100}%`,
  };
}

/** The part of the photo the frame shows, in the photo's own pixels. */
export function sourceRect(
  photo: PhotoSize,
  aspect: number,
  { zoom, offset }: Framing,
) {
  const { w, h, scale } = displayedSize(photo, aspect, zoom);
  const frameH = 1 / aspect;
  const left = 0.5 + offset.x - w / 2;
  const top = frameH / 2 + offset.y - h / 2;
  return {
    sx: -left / scale,
    sy: -top / scale,
    sw: 1 / scale,
    sh: frameH / scale,
  };
}

/** The framing as the crop that is stored. */
export function cropFromFraming(
  photo: PhotoSize,
  aspect: number,
  framing: Framing,
): ImageCrop {
  const { sx, sy, sw, sh } = sourceRect(photo, aspect, framing);
  return clampCrop({
    x: sx / photo.width,
    y: sy / photo.height,
    width: sw / photo.width,
    height: sh / photo.height,
  });
}

/**
 * The framing that shows a stored crop again. A crop of another shape than
 * the frame (the frame's shape was changed) is shown whole and centred, as
 * far as the photo reaches around it.
 */
export function framingFromCrop(
  photo: PhotoSize,
  aspect: number,
  crop: ImageCrop | null,
): Framing {
  if (!crop) return INITIAL_FRAMING;

  const cropWidth = crop.width * photo.width;
  const cropHeight = crop.height * photo.height;
  const { scale: base } = displayedSize(photo, aspect, 1);
  const zoom = clampZoom(
    Math.min(1 / cropWidth, 1 / aspect / cropHeight) / base,
  );

  const { w, h, scale } = displayedSize(photo, aspect, zoom);
  const centreX = (crop.x + crop.width / 2) * photo.width;
  const centreY = (crop.y + crop.height / 2) * photo.height;

  return {
    zoom,
    offset: clampOffset(photo, aspect, zoom, {
      x: w / 2 - centreX * scale,
      y: h / 2 - centreY * scale,
    }),
  };
}

/** A crop's shape (width over height) in pixels. */
export function cropAspect(photo: PhotoSize, crop: ImageCrop) {
  return (crop.width * photo.width) / (crop.height * photo.height);
}
