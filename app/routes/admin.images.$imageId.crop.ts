import { data } from "react-router";
import { z } from "zod";

import type { Route } from "./+types/admin.images.$imageId.crop";

import { requestLoggerContext } from "~/features/auth/middleware.server";
import { setImageCrop } from "~/models/image.server";
import { cropFieldSchema } from "~/shared/image-crop";

const FramingSchema = z.object({
  // empty shows the whole photo again
  crop: cropFieldSchema.refine((crop) => crop !== undefined),
  // the stored photo's size as the editor measured it, for rows stored
  // before dimensions were recorded
  width: z.coerce.number().int().positive().max(100_000),
  height: z.coerce.number().int().positive().max(100_000),
});

/**
 * Saves the framing an admin gave a photo in the "Adjust photo" dialog
 * (app/components/admin-image-framer.tsx). Staff only, by way of the admin
 * layout's middleware.
 */
export async function action({ request, params, context }: Route.ActionArgs) {
  const parsed = FramingSchema.safeParse(
    Object.fromEntries(await request.formData()),
  );
  if (!parsed.success) {
    return data(
      { ok: false, error: "That framing could not be read. Try again." },
      { status: 400 },
    );
  }

  const { crop, width, height } = parsed.data;
  const image = await setImageCrop(params.imageId, crop ?? null, {
    width,
    height,
  });
  if (!image) {
    return data(
      { ok: false, error: "This photo no longer exists." },
      { status: 404 },
    );
  }

  context
    .get(requestLoggerContext)
    .info({ imageId: params.imageId, cropped: crop !== null }, "Photo framed");

  return { ok: true };
}
