import { z } from "zod";

import type { Text } from "~/features/site-text/text";

export function createPasswordSchema(t: Text) {
  return z
    .string({ error: t("auth.validation.passwordRequired") })
    .min(8, t("auth.validation.passwordTooShort"))
    .max(128, t("auth.validation.passwordTooLong"));
}

export function withPasswordConfirmation<Shape extends z.ZodRawShape>(
  shape: Shape,
  t: Text,
) {
  return z
    .object({
      ...shape,
      password: createPasswordSchema(t),
      confirmPassword: z.string({
        error: t("auth.validation.confirmRequired"),
      }),
    })
    .refine(
      (value) => {
        const pair = value as { password: string; confirmPassword: string };
        return pair.password === pair.confirmPassword;
      },
      {
        message: t("auth.validation.passwordsMatch"),
        path: ["confirmPassword"],
      },
    );
}
