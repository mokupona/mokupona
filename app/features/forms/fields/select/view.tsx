import { getSelectProps, type FieldMetadata } from "@conform-to/react";
import type z from "zod";

import type { SelectFieldSchema } from "./model";

import { SelectField as BaseSelectField } from "~/components/forms";
import { useText } from "~/features/site-text/site-text-context";

type SelectFieldProps = {
  fieldConfig: z.infer<typeof SelectFieldSchema>;
  fieldMetadata: FieldMetadata<string>;
};

export function SelectField({
  fieldConfig: config,
  fieldMetadata: metadata,
}: SelectFieldProps) {
  const t = useText();

  return (
    <BaseSelectField
      labelProps={{ children: config.data.label }}
      description={config.data.description}
      selectProps={{
        ...getSelectProps(metadata),
        options: [
          { label: t("signup.select.placeholder"), value: "" },
          ...config.data.options.map((option) => ({
            label: option,
            value: option,
          })),
        ],
      }}
      errors={metadata.errors}
    />
  );
}
