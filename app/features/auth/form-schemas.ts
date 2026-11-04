import { parseWithZod } from "@conform-to/zod/v4";
import { z } from "zod";

import type { Text } from "~/features/site-text/text";

export async function parseRequestForm<Schema extends z.ZodType>(
  request: Request,
  schema: Schema,
) {
  return parseWithZod(await request.formData(), { schema });
}

// These take the site texts so their messages follow the admin's edits; a
// route builds them once with useText() for the browser and with getText()
// for its action.

export function createDisplayNameSchema(t: Text) {
  const error = t("auth.validation.nameRequired");
  return z.string({ error }).trim().min(1, error);
}

export function createEmailSchema(t: Text) {
  return z.email({ error: t("auth.validation.emailRequired") });
}
