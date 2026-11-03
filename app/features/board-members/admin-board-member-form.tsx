import {
  getFormProps,
  getInputProps,
  getTextareaProps,
  useForm,
  type DefaultValue,
  type SubmissionResult,
} from "@conform-to/react";
import { getZodConstraint, parseWithZod } from "@conform-to/zod/v4";
import { Form } from "react-router";
import type { z } from "zod";

import { MemberSchema } from "./schema";

import { Field, fileFieldClassName, TextareaField } from "~/components/forms";
import { Button } from "~/components/ui/button";
import { VALID_IMAGE_TYPES } from "~/shared/image";

type AdminBoardMemberFormProps = {
  lastResult?: SubmissionResult;
  defaultValue?: DefaultValue<z.input<typeof MemberSchema>>;
  heading: React.ReactNode;
  description: React.ReactNode;
  submitText: string;
};

export function AdminBoardMemberForm({
  lastResult,
  defaultValue,
  heading,
  description,
  submitText,
}: AdminBoardMemberFormProps) {
  const [form, fields] = useForm({
    lastResult,
    shouldValidate: "onBlur",
    constraint: getZodConstraint(MemberSchema),
    defaultValue,
    onValidate({ formData }) {
      return parseWithZod(formData, { schema: MemberSchema });
    },
  });

  return (
    <>
      <div className="flex flex-col gap-3">
        <h2 className="text-3xl leading-tight font-light tracking-tight">
          {heading}
        </h2>
        <p>{description}</p>
      </div>

      <Form
        method="POST"
        encType="multipart/form-data"
        replace
        className="mt-6 flex flex-col gap-6"
        {...getFormProps(form)}
      >
        <Field
          labelProps={{ children: "Name" }}
          inputProps={{ ...getInputProps(fields.name, { type: "text" }) }}
          errors={fields.name.errors}
        />

        <Field
          labelProps={{ children: "Position" }}
          inputProps={{ ...getInputProps(fields.position, { type: "text" }) }}
          errors={fields.position.errors}
        />

        <TextareaField
          labelProps={{ children: "Bio" }}
          description="A few lines shown under their portrait on the about page. Optional."
          textareaProps={{ ...getTextareaProps(fields.bio), rows: 4 }}
          errors={fields.bio.errors}
        />

        <Field
          labelProps={{ children: "Photo" }}
          inputProps={{
            ...getInputProps(fields.image, { type: "file" }),
            tabIndex: 0,
            accept: VALID_IMAGE_TYPES.join(","),
            className: fileFieldClassName,
          }}
          errors={fields.image.errors}
        />

        <Button type="submit">{submitText}</Button>
      </Form>
    </>
  );
}
