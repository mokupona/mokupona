// The framing an admin gives a photo: which part of it to show. Stored on the
// Image row as four fractions of the photo's width and height, so it holds
// whatever size the provider serves. The file itself is never cut: Cloudinary
// crops on delivery (app/shared/image.ts), and the local provider used in dev
// and CI frames the whole file with CSS (`framedImageStyle`).

import { z } from "zod";

export interface ImageCrop {
  /** left and top edge, as fractions of the photo's width and height */
  x: number;
  y: number;
  /** size, as fractions of the photo's width and height */
  width: number;
  height: number;
}

/** The crop columns of an Image row, as Prisma reads and writes them. */
export interface ImageCropColumns {
  cropX?: number | null;
  cropY?: number | null;
  cropWidth?: number | null;
  cropHeight?: number | null;
}

/** Smaller than this and a crop is a few pixels of noise, not a framing. */
const MIN_CROP_SIDE = 0.02;
/** Rounding slack, so a crop that ends exactly on the edge still counts. */
const EDGE = 1e-6;

function isSaneCrop({ x, y, width, height }: ImageCrop) {
  return (
    [x, y, width, height].every(Number.isFinite) &&
    x >= -EDGE &&
    y >= -EDGE &&
    width >= MIN_CROP_SIDE &&
    height >= MIN_CROP_SIDE &&
    x + width <= 1 + EDGE &&
    y + height <= 1 + EDGE
  );
}

/** Pulls `value` back inside the photo. */
export function clampCrop({ x, y, width, height }: ImageCrop): ImageCrop {
  const w = Math.min(1, Math.max(MIN_CROP_SIDE, width));
  const h = Math.min(1, Math.max(MIN_CROP_SIDE, height));
  return {
    x: Math.min(1 - w, Math.max(0, x)),
    y: Math.min(1 - h, Math.max(0, y)),
    width: w,
    height: h,
  };
}

/**
 * The crop of an Image row, or null when it has none (or a half-written
 * one). A crop that covers the whole photo is no crop at all.
 */
export function cropOf(image: ImageCropColumns): ImageCrop | null {
  const { cropX, cropY, cropWidth, cropHeight } = image;
  if (cropX == null || cropY == null || cropWidth == null || cropHeight == null)
    return null;
  const crop = { x: cropX, y: cropY, width: cropWidth, height: cropHeight };
  if (!isSaneCrop(crop)) return null;
  if (crop.width >= 1 - EDGE && crop.height >= 1 - EDGE) return null;
  return clampCrop(crop);
}

/** The columns to write for `crop`; null clears them. */
export function cropColumns(
  crop: ImageCrop | null,
): Required<ImageCropColumns> {
  return {
    cropX: crop?.x ?? null,
    cropY: crop?.y ?? null,
    cropWidth: crop?.width ?? null,
    cropHeight: crop?.height ?? null,
  };
}

/**
 * A crop as a form sends it: four numbers, space-separated, or an empty
 * string for "show the whole photo".
 */
export function serializeCrop(crop: ImageCrop | null) {
  if (!crop) return "";
  return [crop.x, crop.y, crop.width, crop.height]
    .map((n) => n.toFixed(6))
    .join(" ");
}

/**
 * Reads a crop field. Absent leaves the framing as it is (undefined), empty
 * clears it (null), anything else must be a sane crop.
 */
export const cropFieldSchema = z
  .string()
  .optional()
  .transform((value, ctx): ImageCrop | null | undefined => {
    if (value === undefined) return undefined;
    if (value.trim() === "") return null;
    const parts = value.trim().split(/\s+/).map(Number);
    const crop = {
      x: parts[0],
      y: parts[1],
      width: parts[2],
      height: parts[3],
    };
    if (parts.length !== 4 || !isSaneCrop(crop)) {
      ctx.addIssue({ code: "custom", message: "Invalid photo framing" });
      return z.NEVER;
    }
    return clampCrop(crop);
  });

/** The crop in whole pixels of a `width` × `height` photo. */
export function cropPixels(
  crop: ImageCrop,
  { width, height }: { width: number; height: number },
) {
  const x = Math.round(crop.x * width);
  const y = Math.round(crop.y * height);
  return {
    x,
    y,
    width: Math.max(1, Math.min(width - x, Math.round(crop.width * width))),
    height: Math.max(1, Math.min(height - y, Math.round(crop.height * height))),
  };
}

/**
 * The size a photo shows at once framed: its crop in pixels, or the whole
 * photo. Null when the row predates stored dimensions.
 */
export function framedSize(
  image: ImageCropColumns & { width?: number | null; height?: number | null },
): { width: number; height: number } | null {
  const { width, height } = image;
  if (!width || !height) return null;
  const crop = cropOf(image);
  if (!crop) return { width, height };
  const framed = cropPixels(crop, { width, height });
  return { width: framed.width, height: framed.height };
}

/**
 * How to place the whole photo inside a box of `frameAspect` (width over
 * height) so the box shows the crop, centred and covering it like
 * object-fit: cover. Percentages of the box, for an absolutely positioned
 * <img>. Used where the delivered file isn't already cropped.
 */
export function framedImageStyle(
  crop: ImageCrop,
  photo: { width: number; height: number },
  frameAspect: number,
) {
  const cropAspect = (crop.width * photo.width) / (crop.height * photo.height);
  // in units of the box's width; its height is 1 / frameAspect
  const shownWidth = Math.max(1, cropAspect / frameAspect);
  const shownHeight = shownWidth / cropAspect;
  const photoWidth = shownWidth / crop.width;
  const photoHeight = shownHeight / crop.height;
  const left = (1 - shownWidth) / 2 - crop.x * photoWidth;
  const top = (1 / frameAspect - shownHeight) / 2 - crop.y * photoHeight;

  const percent = (n: number) => `${(n * 100).toFixed(4)}%`;
  return {
    position: "absolute",
    left: percent(left),
    top: percent(top * frameAspect),
    width: percent(photoWidth),
    height: percent(photoHeight * frameAspect),
    maxWidth: "none",
  } as const;
}
