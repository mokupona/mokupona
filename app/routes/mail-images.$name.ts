import type { Route } from "./+types/mail-images.$name";

import { getLocalImageFile } from "~/features/images/providers/local.server";
import { localMailImageKey } from "~/features/mail/mail-images.server";
import { requireFound } from "~/shared/http.server";

/**
 * A picture from a mail message, under the local image provider (dev and
 * CI). Cloudinary serves its own, so on the live site nothing links here.
 * Public, since whoever got the mail loads it.
 */
export async function loader({ params }: Route.LoaderArgs) {
  const key = requireFound(localMailImageKey(params.name));
  const file = requireFound(await getLocalImageFile(key));

  return new Response(file.stream(), {
    headers: {
      "Content-Type": file.type || "application/octet-stream",
      "Content-Length": String(file.size),
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
