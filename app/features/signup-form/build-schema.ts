import z from "zod";

import { buildSubmissionSchema } from "~/features/forms/build-submission-schema";
import type { FieldDescriptor } from "~/features/forms/fields";
import type { Text } from "~/features/site-text/text";

export function buildSignupSchema(
  descriptors: Array<FieldDescriptor>,
  t: Text,
) {
  const privacyError = t("signup.validation.privacy");

  return buildSubmissionSchema(descriptors, t)
    .extend({
      acceptedPrivacy: z.boolean({ error: privacyError }),
    })
    .refine((value) => value.acceptedPrivacy === true, {
      path: ["acceptedPrivacy"],
      error: privacyError,
    });
}
