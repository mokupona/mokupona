import type {
  LiveDataImageRow,
  LiveDataSource,
  LiveDataTables,
} from "./snapshot";

import type { ImageFolder } from "~/features/images/image-storage.server";
import type { StoredImage } from "~/features/images/types";
import type { ImageProviderConfig } from "~/shared/image";

/**
 * - `share`: both sites read from the same Cloudinary cloud, so the copied
 *   rows already point at displayable assets and no bytes move. The
 *   Cloudinary provider only ever destroys assets inside its own
 *   `CLOUDINARY_FOLDER_PREFIX`, so deleting a copied event on staging cannot
 *   reach the live site's photos.
 * - `copy`: anything else (a laptop on local storage, a different cloud, a
 *   live site on local storage). Every image is downloaded from the source
 *   and stored with this site's own provider.
 */
export type ImageStrategy = "share" | "copy";

export function chooseImageStrategy(
  source: LiveDataSource,
  target: ImageProviderConfig,
): ImageStrategy {
  const sameCloud =
    source.imageProvider === "cloudinary" &&
    target.imageProvider === "cloudinary" &&
    source.cloudinaryCloudName !== null &&
    source.cloudinaryCloudName === target.cloudinaryCloudName;

  return sameCloud ? "share" : "copy";
}

/** Where the original bytes of a source image can be downloaded. */
export function sourceImageUrl(
  image: Pick<LiveDataImageRow, "id" | "storageKey" | "version">,
  source: LiveDataSource,
  sourceOrigin: string,
): string {
  if (source.imageProvider === "cloudinary" && source.cloudinaryCloudName) {
    // no transformation segment: the untouched original, not a q_auto variant
    const version = image.version == null ? "" : `v${image.version}/`;
    return `https://res.cloudinary.com/${source.cloudinaryCloudName}/image/upload/${version}${image.storageKey}`;
  }
  return `${sourceOrigin}/file/${encodeURIComponent(image.id)}`;
}

/** The asset folder each image belongs in, judged by what shows it. */
export function imageFolders(
  tables: Pick<
    LiveDataTables,
    "events" | "boardMembers" | "eventGalleryImages"
  >,
): Map<string, ImageFolder> {
  const folders = new Map<string, ImageFolder>();
  const claim = (imageId: string | null, folder: ImageFolder) => {
    if (imageId && !folders.has(imageId)) folders.set(imageId, folder);
  };

  for (const event of tables.events) claim(event.imageId, "events");
  for (const member of tables.boardMembers) {
    claim(member.imageId, "board-members");
  }
  for (const link of tables.eventGalleryImages) {
    claim(link.imageId, "event-gallery");
  }

  return folders;
}

/** Drop images that could not be copied, and every reference to them. */
export function withoutImages(
  tables: LiveDataTables,
  imageIds: ReadonlySet<string>,
): LiveDataTables {
  if (imageIds.size === 0) return tables;

  const dropped = (id: string | null) => id !== null && imageIds.has(id);

  return {
    ...tables,
    images: tables.images.filter((image) => !imageIds.has(image.id)),
    events: tables.events.map((event) =>
      dropped(event.imageId) ? { ...event, imageId: null } : event,
    ),
    boardMembers: tables.boardMembers.map((member) =>
      dropped(member.imageId) ? { ...member, imageId: null } : member,
    ),
    eventGalleryImages: tables.eventGalleryImages.filter(
      (link) => !imageIds.has(link.imageId),
    ),
  };
}

const DOWNLOAD_TIMEOUT_MS = 30_000;
export const MAX_IMAGE_DOWNLOAD_BYTES = 15 * 1024 * 1024;

async function download(
  url: string,
  fetchImpl: typeof fetch,
): Promise<{ bytes: Uint8Array<ArrayBuffer>; contentType: string | null }> {
  const response = await fetchImpl(url, {
    signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);

  const declared = Number(response.headers.get("content-length") ?? 0);
  if (declared > MAX_IMAGE_DOWNLOAD_BYTES) {
    throw new Error(`${url} is larger than the copy limit`);
  }

  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_IMAGE_DOWNLOAD_BYTES) {
    throw new Error(`${url} returned ${bytes.byteLength} bytes`);
  }

  const contentType =
    response.headers.get("content-type")?.split(";")[0].trim() ?? null;
  return {
    bytes,
    contentType: contentType?.startsWith("image/") ? contentType : null,
  };
}

async function settleInPool<T, R>(
  items: readonly T[],
  limit: number,
  run: (item: T) => Promise<R>,
): Promise<PromiseSettledResult<R>[]> {
  const results: PromiseSettledResult<R>[] = new Array(items.length);
  let next = 0;

  async function worker() {
    while (next < items.length) {
      const index = next++;
      try {
        results[index] = {
          status: "fulfilled",
          value: await run(items[index]),
        };
      } catch (reason) {
        results[index] = { status: "rejected", reason };
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, worker),
  );
  return results;
}

export interface ImageCopy {
  storageKey: string;
  contentType: string;
  version: number | null;
  width: number | null;
  height: number | null;
  blurDataUrl: string | null;
}

export interface CopyImagesDeps {
  fetch: typeof fetch;
  store: (file: File, folder: ImageFolder) => Promise<StoredImage>;
  /** This site's current rows for the incoming ids, from an earlier copy. */
  previousCopies: ReadonlyMap<string, ImageCopy>;
  /** Whether a previous copy's bytes are still where the provider keeps them. */
  copyStillPresent: (storageKey: string) => Promise<boolean>;
  concurrency?: number;
}

export interface CopyImagesResult {
  images: LiveDataImageRow[];
  failed: { id: string; reason: unknown }[];
  /** Keys stored by this run — to destroy again if the import fails later. */
  storedKeys: string[];
  copied: number;
  reused: number;
}

/**
 * Bring every source image into this site's storage. Images are immutable
 * once stored (a replaced cover is a new row), so a row this site already
 * copied under the same id is reused instead of downloaded again.
 */
export async function copyImages(
  {
    images,
    folders,
    source,
    sourceOrigin,
  }: {
    images: LiveDataImageRow[];
    folders: ReadonlyMap<string, ImageFolder>;
    source: LiveDataSource;
    sourceOrigin: string;
  },
  deps: CopyImagesDeps,
): Promise<CopyImagesResult> {
  const settled = await settleInPool(
    images,
    deps.concurrency ?? 4,
    async (image): Promise<{ row: LiveDataImageRow; stored: boolean }> => {
      const previous = deps.previousCopies.get(image.id);
      // an equal key means the row was shared, not copied, last time
      if (
        previous &&
        previous.storageKey !== image.storageKey &&
        (await deps.copyStillPresent(previous.storageKey))
      ) {
        return { row: { ...image, ...previous }, stored: false };
      }

      const { bytes, contentType } = await download(
        sourceImageUrl(image, source, sourceOrigin),
        deps.fetch,
      );
      const type = contentType ?? image.contentType;
      const stored = await deps.store(
        new File([bytes], image.id, { type }),
        folders.get(image.id) ?? "event-gallery",
      );

      return {
        row: {
          ...image,
          contentType: type,
          storageKey: stored.storageKey,
          version: stored.version ?? null,
          width: stored.width ?? image.width,
          height: stored.height ?? image.height,
          blurDataUrl: stored.blurDataUrl ?? image.blurDataUrl,
        },
        stored: true,
      };
    },
  );

  const result: CopyImagesResult = {
    images: [],
    failed: [],
    storedKeys: [],
    copied: 0,
    reused: 0,
  };

  settled.forEach((outcome, index) => {
    if (outcome.status === "rejected") {
      result.failed.push({ id: images[index].id, reason: outcome.reason });
      return;
    }
    const { row, stored } = outcome.value;
    result.images.push(row);
    if (stored) {
      result.storedKeys.push(row.storageKey);
      result.copied += 1;
    } else {
      result.reused += 1;
    }
  });

  return result;
}
