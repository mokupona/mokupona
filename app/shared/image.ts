import { z } from "zod";

import { cropOf, cropPixels, type ImageCropColumns } from "./image-crop";

const IMAGE_FITS = ["cover", "contain", "fill"] as const;
export type ImageFit = (typeof IMAGE_FITS)[number];

export interface ImageUrlSource extends ImageCropColumns {
  id?: string | null;
  /** Cloudinary public_id / local file key — required on every row. */
  storageKey: string;
  version?: number | null;
  /** the stored file's size, which a crop needs to be cut in pixels */
  width?: number | null;
  height?: number | null;
}

export interface ImageDisplaySource extends ImageUrlSource {
  blurDataUrl?: string | null;
}

export interface ImageProviderConfig {
  imageProvider: "local" | "cloudinary";
  cloudinaryCloudName: string | null;
}

export interface ImageTransformOptions {
  width?: number;
  height?: number;
  fit?: ImageFit;
  /** the whole photo, ignoring the admin's framing (to edit that framing) */
  uncropped?: boolean;
}

const CLOUDINARY_CROPS: Record<ImageFit, string> = {
  cover: "c_fill,g_auto",
  contain: "c_fit",
  fill: "c_scale",
};

function cloudinaryTransform(
  { width, height, fit = "cover" }: ImageTransformOptions,
  framed: boolean,
) {
  const parts = ["f_auto", "q_auto"];
  if (width !== undefined || height !== undefined) {
    // inside an admin's framing, filling a frame of another shape keeps to
    // its middle rather than letting Cloudinary pick a subject again
    parts.push(
      framed && fit === "cover" ? "c_fill,g_center" : CLOUDINARY_CROPS[fit],
    );
    if (width !== undefined) parts.push(`w_${width}`);
    if (height !== undefined) parts.push(`h_${height}`);
  }
  return parts.join(",");
}

/**
 * The framing as a Cloudinary step of its own, applied before any resizing,
 * or null when the image has none (or no stored size to cut it by).
 */
function cloudinaryCropStep(image: ImageUrlSource) {
  const crop = cropOf(image);
  if (!crop || !image.width || !image.height) return null;
  const { x, y, width, height } = cropPixels(crop, {
    width: image.width,
    height: image.height,
  });
  return `c_crop,x_${x},y_${y},w_${width},h_${height}`;
}

/** Whether images are delivered through Cloudinary, which can crop them. */
function deliversThroughCloudinary(
  image: ImageUrlSource,
  { imageProvider, cloudinaryCloudName }: ImageProviderConfig,
) {
  return Boolean(
    cloudinaryCloudName && (imageProvider === "cloudinary" || !image.id),
  );
}

/**
 * Whether getImageUrl hands out this image already cut to its framing. When
 * it doesn't (the local provider serves the stored file as it is), the page
 * frames the whole file itself.
 */
export function deliversFramedImage(
  image: ImageUrlSource,
  config: ImageProviderConfig,
) {
  return (
    deliversThroughCloudinary(image, config) &&
    cloudinaryCropStep(image) !== null
  );
}

export function getImageUrl(
  image: ImageUrlSource,
  config: ImageProviderConfig,
  options: ImageTransformOptions = {},
): string {
  const { storageKey, version, id } = image;
  const { cloudinaryCloudName } = config;

  if (deliversThroughCloudinary(image, config)) {
    const versionSegment = version == null ? "" : `v${version}/`;
    const crop = options.uncropped ? null : cloudinaryCropStep(image);
    const steps = [crop, cloudinaryTransform(options, crop !== null)]
      .filter(Boolean)
      .join("/");
    return `https://res.cloudinary.com/${cloudinaryCloudName}/image/upload/${steps}/${versionSegment}${storageKey}`;
  }

  return id ? `/file/${id}` : "";
}

export const RESPONSIVE_IMAGE_WIDTHS = [432, 648, 864, 1080] as const;

const MAX_IMAGE_BYTES = 3 * 1024 * 1024;
export const MAX_STAGED_IMAGE_BYTES = 4 * 1024 * 1024;
/**
 * How many files a gallery upload may carry in one submission. Policy, not
 * plumbing: the admin pages print it in their field description, so it has to
 * live in a module the client bundle is allowed to reach.
 */
export const MAX_GALLERY_FILES = 12;
export const IMAGE_SIZE_ERROR = "File cannot be greater than 3MB";
export const VALID_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const IMAGE_TYPE_ERROR = "File must be a JPEG, PNG or WebP image";

export function imageFileSchema() {
  return z
    .instanceof(File, { message: "You must select a file" })
    .refine((file) => {
      return file.size !== 0;
    }, "You must select a file")
    .refine((file) => {
      return file.size <= MAX_IMAGE_BYTES;
    }, IMAGE_SIZE_ERROR)
    .refine((file) => {
      return VALID_IMAGE_TYPES.includes(file.type);
    }, IMAGE_TYPE_ERROR);
}
