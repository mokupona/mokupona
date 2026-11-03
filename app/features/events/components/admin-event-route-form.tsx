import {
  FormProvider,
  getFormProps,
  useForm,
  type DefaultValue,
  type SubmissionResult,
} from "@conform-to/react";
import { getZodConstraint, parseWithZod } from "@conform-to/zod/v4";
import { Form } from "react-router";
import type { z } from "zod";

import type { EventEditSchema, EventSchema } from "../event-schema";
import type { AddressOptionModel } from "../view-models";

import { AdminEventForm } from "./admin-event-form";

import type { AnswerCountsByFieldKey } from "~/features/signup-form/read.server";
import type { ImageDisplaySource } from "~/shared/image";

type AdminEventRouteFormProps = {
  schema: typeof EventSchema | typeof EventEditSchema;
  lastResult?: SubmissionResult;
  defaultValue?: DefaultValue<z.input<typeof EventEditSchema>>;
  addressOptions: AddressOptionModel[];
  submitText: string;
  pageTitle: string;
  cancelHref: string;
  lockFieldKeys?: boolean;
  answerCounts?: AnswerCountsByFieldKey;
  currentImage?: ImageDisplaySource | null;
};

export function AdminEventRouteForm({
  schema,
  lastResult,
  defaultValue,
  addressOptions,
  submitText,
  pageTitle,
  cancelHref,
  lockFieldKeys,
  answerCounts,
  currentImage,
}: AdminEventRouteFormProps) {
  const [form, fields] = useForm<
    z.input<typeof EventEditSchema>,
    z.output<typeof EventEditSchema>
  >({
    lastResult,
    shouldValidate: "onBlur",
    constraint: getZodConstraint(schema),
    defaultValue,
    onValidate({ formData }) {
      return parseWithZod(formData, { schema });
    },
  });

  return (
    <FormProvider context={form.context}>
      <Form
        method="POST"
        encType="multipart/form-data"
        replace
        {...getFormProps(form)}
      >
        <AdminEventForm
          fields={fields}
          addressOptions={addressOptions}
          submitText={submitText}
          pageTitle={pageTitle}
          cancelHref={cancelHref}
          lockFieldKeys={lockFieldKeys}
          answerCounts={answerCounts}
          currentImage={currentImage}
        />
      </Form>
    </FormProvider>
  );
}
