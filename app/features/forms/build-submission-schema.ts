import z from "zod";

import { zodForField, type FieldDescriptor } from "./fields";

import type { Text } from "~/features/site-text/text";

export function buildSubmissionSchema(
  descriptors: Array<FieldDescriptor>,
  t: Text,
) {
  const shape: Record<string, z.ZodType> = {};

  for (const descriptor of descriptors) {
    if (descriptor.type === "list") {
      const itemShape = Object.fromEntries(
        descriptor.data.itemFields.map((itemField) => [
          itemField.data.name,
          zodForField(itemField, t),
        ]),
      );
      const { label, maxCount } = descriptor.data;
      const listSchema = z.array(z.object(itemShape)).max(maxCount, {
        error: t(
          maxCount === 1
            ? "signup.validation.listMax.one"
            : "signup.validation.listMax.other",
          { label, count: maxCount },
        ),
      });
      shape[descriptor.data.name] = descriptor.data.required
        ? listSchema.min(1, {
            error: t("signup.validation.required", { label }),
          })
        : listSchema;
    } else {
      shape[descriptor.data.name] = zodForField(descriptor, t);
    }
  }

  return z.object(shape);
}
