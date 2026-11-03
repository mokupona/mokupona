import z from "zod";

import { CheckboxFieldSchema } from "./checkbox/model";
import { CheckboxField } from "./checkbox/view";
import { EmailFieldSchema } from "./email/model";
import { EmailField } from "./email/view";
import { PhoneFieldSchema } from "./phone/model";
import { PhoneField } from "./phone/view";
import { SelectFieldSchema } from "./select/model";
import { SelectField } from "./select/view";
import { TextFieldSchema } from "./text/model";
import { TextField } from "./text/view";
import { TextareaFieldSchema } from "./textarea/model";
import { TextareaField } from "./textarea/view";

import type { Text } from "~/features/site-text/text";

export const NonListFieldDescriptorSchema = z.discriminatedUnion("type", [
  TextFieldSchema,
  TextareaFieldSchema,
  EmailFieldSchema,
  PhoneFieldSchema,
  CheckboxFieldSchema,
  SelectFieldSchema,
]);

export type NonListFieldDescriptor = z.infer<
  typeof NonListFieldDescriptorSchema
>;
export type NonListFieldType = NonListFieldDescriptor["type"];

export const NON_LIST_FIELD_TYPES = [
  "text",
  "textarea",
  "email",
  "phone",
  "checkbox",
  "select",
] as const satisfies readonly NonListFieldType[];

type AssertAllTypesListed =
  NonListFieldType extends (typeof NON_LIST_FIELD_TYPES)[number] ? true : never;
export const NON_LIST_FIELD_TYPES_COMPLETE: AssertAllTypesListed = true;

export type ViewsFor<Descriptor extends { type: string }> = {
  [K in Descriptor["type"]]: (props: {
    fieldConfig: Extract<Descriptor, { type: K }>;
    fieldMetadata: any;
  }) => React.ReactNode;
};

export const NonListFieldViews = {
  text: TextField,
  email: EmailField,
  phone: PhoneField,
  textarea: TextareaField,
  checkbox: CheckboxField,
  select: SelectField,
} as const satisfies ViewsFor<NonListFieldDescriptor>;

export function getViewForNonListField(
  descriptor: NonListFieldDescriptor,
): React.ElementType {
  return NonListFieldViews[descriptor.type];
}

export function zodForField(descriptor: NonListFieldDescriptor, t: Text) {
  const { label, required } = descriptor.data;

  const requiredError = t("signup.validation.required", { label });
  const invalidError = t("signup.validation.invalid", { label });

  switch (descriptor.type) {
    case "text":
    case "textarea":
    case "phone": {
      const schema = z.string({ error: requiredError }).trim();
      if (required) return schema.min(1, { error: requiredError });
      return schema.optional();
    }

    case "email": {
      const schema = z
        .string({ error: requiredError })
        .trim()
        .pipe(z.email({ error: invalidError }));
      if (required) return schema;
      return schema.optional();
    }

    case "checkbox": {
      const schema = z.boolean().default(false);
      if (!required) return schema.optional();
      return schema.refine((value) => value === true, {
        error: requiredError,
      });
    }

    case "select": {
      const { options } = descriptor.data;
      const schema = z
        .string({ error: requiredError })
        .refine((value) => options.includes(value), {
          error: invalidError,
        });
      if (required) return schema;
      return schema.optional();
    }

    default:
      assertNever(descriptor);
  }
}

function assertNever(t: never): never {
  throw new Error(`Unhandled case for type: ${t}`);
}
