import { z } from "zod";

import { imageFileSchema } from "~/shared/image";

export const MemberSchema = z.object({
  name: z
    .string({ error: "You must enter a name for the board member" })
    .trim(),
  position: z
    .string({
      error: "You must enter a position for the board member",
    })
    .trim(),
  // optional, so an empty textarea clears the bio rather than failing
  bio: z.string().trim().max(600).optional(),
  image: imageFileSchema().optional(),
});
