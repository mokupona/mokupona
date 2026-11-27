// Pictures an admin pastes or drops into a mail message: stored with the
// site's image provider, under a folder of their own, and put into the
// Markdown by their full address, since a mail is read far from the site.
//
// They get no Image row. Nothing on the site shows them and no table refers
// to them, only the mails that went out with them, so no cleanup (and no
// live-data sync) may touch them.

import type { ImageFolder } from "~/features/images/image-storage.server";
import type { StoredImage } from "~/features/images/types";
import type { ImageProviderConfig } from "~/shared/image";

export const MAIL_IMAGE_FOLDER = "mail" satisfies ImageFolder;

/** Where the local provider's mail pictures are served (`mail-images.$name.ts`). */
const LOCAL_ROUTE = "/mail-images";

// the local provider's keys are "<folder>/<uuid>"
const LOCAL_NAME =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function mailImageConfigFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): ImageProviderConfig {
  return {
    imageProvider: env.IMAGE_PROVIDER === "cloudinary" ? "cloudinary" : "local",
    cloudinaryCloudName: env.CLOUDINARY_CLOUD_NAME ?? null,
  };
}

/**
 * The full address a mail shows a stored picture by. On Cloudinary that's
 * the file as uploaded, in its own format (f_auto would hand WebP or AVIF to
 * whichever mail client asked first, and not every client shows those) and
 * at automatic quality. Locally it's this site's own route.
 */
export function mailImageUrl(
  stored: Pick<StoredImage, "storageKey" | "version">,
  { imageProvider, cloudinaryCloudName }: ImageProviderConfig,
  origin: string,
): string {
  if (imageProvider === "cloudinary" && cloudinaryCloudName) {
    const version = stored.version == null ? "" : `v${stored.version}/`;
    return `https://res.cloudinary.com/${cloudinaryCloudName}/image/upload/q_auto/${version}${stored.storageKey}`;
  }

  const name = stored.storageKey.slice(`${MAIL_IMAGE_FOLDER}/`.length);
  return new URL(`${LOCAL_ROUTE}/${encodeURIComponent(name)}`, origin).href;
}

/** The local provider's key for a name in a mail picture's address, if it is one. */
export function localMailImageKey(name: string | undefined): string | null {
  return name && LOCAL_NAME.test(name) ? `${MAIL_IMAGE_FOLDER}/${name}` : null;
}
