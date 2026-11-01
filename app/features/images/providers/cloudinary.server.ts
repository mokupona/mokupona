import type { UploadApiOptions, UploadApiResponse } from "cloudinary";
import { v2 as cloudinary } from "cloudinary";
import invariant from "tiny-invariant";

import { fetchBlurDataUrl } from "../blur-placeholder.server";
import type { ImageStorageProvider } from "../types";

import { requestLogger } from "~/logger/request-context.server";

function uploadStream(
  buffer: Buffer,
  options: UploadApiOptions,
): Promise<UploadApiResponse> {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      options,
      (error, result) =>
        result ? resolve(result) : reject(error ?? new Error("Upload failed")),
    );
    stream.end(buffer);
  });
}

export function createCloudinaryProvider(
  env: NodeJS.ProcessEnv = process.env,
): ImageStorageProvider {
  const cloudName = env.CLOUDINARY_CLOUD_NAME;
  const apiKey = env.CLOUDINARY_API_KEY;
  const apiSecret = env.CLOUDINARY_API_SECRET;
  const folderPrefix = env.CLOUDINARY_FOLDER_PREFIX;

  invariant(
    cloudName && apiKey && apiSecret && folderPrefix,
    'CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET and CLOUDINARY_FOLDER_PREFIX must be set when IMAGE_PROVIDER="cloudinary"',
  );

  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
    secure: true,
  });

  return {
    async store(file, { folder }) {
      const buffer = Buffer.from(await file.arrayBuffer());
      const result = await uploadStream(buffer, {
        resource_type: "image",
        asset_folder: `${folderPrefix}/${folder}`,
      });

      const blurDataUrl = await fetchBlurDataUrl({
        cloudName,
        publicId: result.public_id,
        version: result.version,
      });

      return {
        storageKey: result.public_id,
        version: result.version,
        width: result.width,
        height: result.height,
        blurDataUrl: blurDataUrl ?? undefined,
      };
    },
    async destroy(storageKey) {
      const folder = await assetFolderOf(storageKey);
      if (folder === null) return; // already gone

      // Every environment shares one cloud, and a staging copy of the live
      // data points at the live site's assets. Destroy only what this
      // environment uploaded: anything outside its own prefix is left alone.
      if (!isInsidePrefix(folder, folderPrefix)) {
        requestLogger.info(
          { storageKey, assetFolder: folder, folderPrefix },
          "Kept a Cloudinary asset owned by another environment",
        );
        return;
      }

      await cloudinary.uploader.destroy(storageKey, { invalidate: true });
    },
  };
}

function isInsidePrefix(folder: string, prefix: string) {
  return folder === prefix || folder.startsWith(`${prefix}/`);
}

/** The asset's folder, or null when Cloudinary no longer has it. */
async function assetFolderOf(storageKey: string): Promise<string | null> {
  try {
    const resource = (await cloudinary.api.resource(storageKey, {
      resource_type: "image",
    })) as { asset_folder?: string; folder?: string };
    return resource.asset_folder ?? resource.folder ?? "";
  } catch (error) {
    if (isNotFound(error)) return null;
    throw error;
  }
}

function isNotFound(error: unknown) {
  const httpCode = (error as { error?: { http_code?: number } } | null)?.error
    ?.http_code;
  return httpCode === 404;
}

export async function uploadStaticAsset(
  bytes: Uint8Array,
  publicId: string,
  env: NodeJS.ProcessEnv = process.env,
): Promise<void> {
  const cloudName = env.CLOUDINARY_CLOUD_NAME;
  const apiKey = env.CLOUDINARY_API_KEY;
  const apiSecret = env.CLOUDINARY_API_SECRET;

  invariant(
    cloudName && apiKey && apiSecret,
    "CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET must be set to upload static assets",
  );

  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
    secure: true,
  });

  await uploadStream(Buffer.from(bytes), {
    resource_type: "image",
    public_id: publicId,
    overwrite: false,
    asset_folder: "static",
  });
}
