import type { Route } from "./+types/admin.mail-images";

import { requestLoggerContext } from "~/features/auth/middleware.server";
import { storeImage } from "~/features/images/image-storage.server";
import { parseImageFormData } from "~/features/images/image-upload.server";
import {
  MAIL_IMAGE_FOLDER,
  mailImageConfigFromEnv,
  mailImageUrl,
} from "~/features/mail/mail-images.server";
import {
  MAIL_IMAGE_FIELD,
  type MailImageReply,
} from "~/features/mail/mail-images.shared";
import { getDomainUrl } from "~/shared/http.server";
import { imageFileSchema } from "~/shared/image";

function reply(body: MailImageReply, status = 200) {
  return Response.json(body, { status });
}

/**
 * Stores a picture pasted or dropped into a mail message
 * (app/features/mail/admin-image-paste.tsx) and replies with the address the
 * Markdown shows it by. Staff only, by way of the admin layout's middleware.
 */
export async function action({ request, context }: Route.ActionArgs) {
  const log = context.get(requestLoggerContext);

  const upload = await parseImageFormData(request, MAIL_IMAGE_FIELD);
  if (!upload.success) {
    return reply({ ok: false, error: upload.uploadError }, 400);
  }

  const file = imageFileSchema().safeParse(
    upload.formData.get(MAIL_IMAGE_FIELD),
  );
  if (!file.success) {
    return reply(
      { ok: false, error: file.error.issues[0]?.message ?? "Not an image" },
      400,
    );
  }

  try {
    const stored = await storeImage(file.data, MAIL_IMAGE_FOLDER);
    const url = mailImageUrl(
      stored,
      mailImageConfigFromEnv(),
      getDomainUrl(request),
    );
    log.info(
      { storageKey: stored.storageKey, bytes: file.data.size },
      "Mail image stored",
    );
    return reply({ ok: true, url });
  } catch (error) {
    log.error({ error }, "Failed to store a mail image");
    return reply(
      {
        ok: false,
        error: "The image couldn't be uploaded. Try again in a moment.",
      },
      502,
    );
  }
}
