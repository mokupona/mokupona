import { z } from "zod";

import type { Text } from "~/features/site-text/text";
import { imageFileSchema } from "~/shared/image";

export const VolunteerSchema = z.object({
  name: z.string({ error: "You must enter a name for the volunteer" }).trim(),
  // optional, so empty inputs clear the field rather than failing
  role: z.string().trim().max(60).optional(),
  bio: z.string().trim().max(600).optional(),
  image: imageFileSchema().optional(),
});

/** Where volunteer sign-ups from the about page land. */
export const VOLUNTEER_INBOX = "contact@mokupona.ch";

// Built from the site texts so its messages follow the admin's edits; the
// about page builds it with useText() and its action with getText().
export function createVolunteerSignupSchema(t: Text) {
  const nameRequired = t("about.signup.nameRequired");
  return z.object({
    name: z
      .string({ error: nameRequired })
      .trim()
      .min(1, nameRequired)
      .max(100),
    email: z.email({ error: t("about.signup.emailRequired") }),
    message: z.string().trim().max(1000).optional(),
  });
}
