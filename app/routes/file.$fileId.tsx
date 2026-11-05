import { redirect } from "react-router";

import type { Route } from "./+types/file.$fileId";

import { getLocalImageFile } from "~/features/images/providers/local.server";
import { getImageById } from "~/models/image.server";
import { requireFound } from "~/shared/http.server";
import { getImageUrl, type ImageProviderConfig } from "~/shared/image";

function imageConfigFromEnv(): ImageProviderConfig {
  return {
    imageProvider:
      process.env.IMAGE_PROVIDER === "cloudinary" ? "cloudinary" : "local",
    cloudinaryCloudName: process.env.CLOUDINARY_CLOUD_NAME ?? null,
  };
}

function createImageResponse(
  body: BodyInit,
  {
    contentType,
    size,
    fileId,
  }: { contentType: string; size: number; fileId: string },
) {
  return new Response(body, {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `inline; filename="${fileId}"`,
      "Content-Length": String(size),
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}

export async function loader({ params }: Route.LoaderArgs) {
  const { fileId } = params;

  const image = requireFound(await getImageById(fileId));
  const config = imageConfigFromEnv();

  if (config.imageProvider === "cloudinary" && config.cloudinaryCloudName) {
    // the stored file, as this route always serves it: the admin's framing
    // is applied where the image is shown, not to the file
    return redirect(getImageUrl(image, config, { uncropped: true }), 302);
  }

  const file = requireFound(await getLocalImageFile(image.storageKey));
  return createImageResponse(file.stream(), {
    contentType: image.contentType,
    size: file.size,
    fileId,
  });
}
