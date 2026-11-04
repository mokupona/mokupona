import { z } from "zod";

import { imageFileSchema } from "~/shared/image";

export const VolunteerSchema = z.object({
  name: z.string({ error: "You must enter a name for the volunteer" }).trim(),
  // optional, so empty inputs clear the field rather than failing
  role: z.string().trim().max(60).optional(),
  bio: z.string().trim().max(600).optional(),
  image: imageFileSchema().optional(),
});
