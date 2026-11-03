import type { FieldMetadata } from "@conform-to/react";
import {
  getInputProps,
  getSelectProps,
  getTextareaProps,
  useFormMetadata,
} from "@conform-to/react";
import { Link } from "react-router";
import type z from "zod";

import type { EventEditSchema } from "../event-schema";
import type { AddressOptionModel } from "../view-models";

import { CoverPhotoField } from "./cover-photo-field";

import { Field, SelectField, TextareaField } from "~/components/forms";
import { BackLink, pageTitleClassName } from "~/components/section";
import { SectionNav } from "~/components/section-nav";
import { SignupFormBuilder } from "~/components/signup-form-builder";
import { Button, buttonVariants } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import type { AnswerCountsByFieldKey } from "~/features/signup-form/read.server";
import { cn } from "~/lib/utils";
import type { ImageDisplaySource } from "~/shared/image";

type FieldsetOf<Schema extends z.ZodType> = {
  [K in keyof z.input<Schema>]-?: FieldMetadata<z.input<Schema>[K]>;
};

type AdminEventFormProps = {
  fields: FieldsetOf<typeof EventEditSchema>;
  addressOptions: AddressOptionModel[];
  submitText: string;
  pageTitle: string;
  cancelHref: string;
  lockFieldKeys?: boolean;
  answerCounts?: AnswerCountsByFieldKey;
  /** The saved cover on edit; absent when creating. */
  currentImage?: ImageDisplaySource | null;
};

const SECTIONS = [
  { id: "section-basics", label: "Basics" },
  { id: "section-photo", label: "Photo" },
  { id: "section-menu-donation", label: "Menu & donation" },
  { id: "section-schedule-pricing", label: "Schedule & pricing" },
  { id: "section-location", label: "Location" },
  { id: "section-signup-form", label: "Signup form" },
];

function SectionCard({
  id,
  title,
  description,
  children,
}: {
  id: string;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <Card id={id} className="scroll-mt-16 md:scroll-mt-8">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent className="flex flex-col gap-6">{children}</CardContent>
    </Card>
  );
}

function SaveBar({
  submitText,
  cancelHref,
}: {
  submitText: string;
  cancelHref: string;
}) {
  const form = useFormMetadata();

  return (
    <div className="bg-background/90 sticky bottom-0 z-10 -mx-2 border-t px-4 py-3 backdrop-blur md:bottom-2 md:mx-0 md:border">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p
          className={cn(
            "text-muted-foreground order-last text-center text-sm sm:order-first sm:text-left",
            !form.dirty && "invisible",
          )}
        >
          Unsaved changes
        </p>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center">
          <Link
            to={cancelHref}
            className={buttonVariants({ variant: "outline" })}
          >
            Cancel
          </Link>
          <Button type="submit">{submitText}</Button>
        </div>
      </div>
    </div>
  );
}

export function AdminEventForm({
  fields,
  addressOptions,
  submitText,
  pageTitle,
  cancelHref,
  lockFieldKeys,
  answerCounts,
  currentImage,
}: AdminEventFormProps) {
  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <div>
        <BackLink to="/admin/events" prefetch="intent">
          Events
        </BackLink>
        <h1 className={pageTitleClassName}>{pageTitle}</h1>
      </div>

      <div className="flex flex-col gap-4 md:flex-row md:items-start md:gap-7">
        <SectionNav sections={SECTIONS} />

        <div className="flex min-w-0 flex-1 flex-col gap-5">
          <SectionCard
            id="section-basics"
            title="Basics"
            description="Title and description guests see on the event page."
          >
            <Field
              labelProps={{ children: "Title" }}
              inputProps={{ ...getInputProps(fields.title, { type: "text" }) }}
              errors={fields.title.errors}
            />

            <TextareaField
              labelProps={{ children: "Description" }}
              textareaProps={{
                ...getTextareaProps(fields.description),
                rows: 10,
              }}
              errors={fields.description.errors}
            />
          </SectionCard>

          <SectionCard
            id="section-photo"
            title="Photo"
            description="The cover photo shown on the event page and cards."
          >
            <CoverPhotoField
              field={fields.cover}
              currentImage={currentImage}
              title={fields.title.value}
            />
          </SectionCard>

          <SectionCard
            id="section-menu-donation"
            title="Menu & donation"
            description="What is served and how donations work."
          >
            <TextareaField
              labelProps={{ children: "Menu" }}
              textareaProps={{
                ...getTextareaProps(fields.menuDescription),
                rows: 10,
              }}
              errors={fields.menuDescription.errors}
            />

            <TextareaField
              labelProps={{ children: "Donation" }}
              textareaProps={{
                ...getTextareaProps(fields.donationDescription),
                rows: 10,
              }}
              errors={fields.donationDescription.errors}
            />
          </SectionCard>

          <SectionCard
            id="section-schedule-pricing"
            title="Schedule & pricing"
            description="When it happens, how many seats, and what it costs."
          >
            <Field
              labelProps={{ children: "Date" }}
              inputProps={{
                ...getInputProps(fields.date, { type: "datetime-local" }),
              }}
              errors={fields.date.errors}
            />

            <div className="flex flex-col gap-4 sm:flex-row sm:justify-between">
              <Field
                className="grow"
                labelProps={{ children: "Slots" }}
                inputProps={{
                  ...getInputProps(fields.slots, { type: "number" }),
                }}
                errors={fields.slots.errors}
              />

              <Field
                className="grow"
                labelProps={{ children: "Price" }}
                inputProps={{
                  ...getInputProps(fields.price, { type: "number" }),
                }}
                errors={fields.price.errors}
              />
            </div>

            <TextareaField
              labelProps={{ children: "Discounts" }}
              textareaProps={{
                ...getTextareaProps(fields.discounts),
                rows: 3,
              }}
              errors={fields.discounts.errors}
            />
          </SectionCard>

          <SectionCard
            id="section-location"
            title="Location"
            description="Where the dinner takes place."
          >
            <SelectField
              labelProps={{ children: "Address" }}
              selectProps={{
                ...getSelectProps(fields.addressId),
                options: addressOptions,
              }}
              errors={fields.addressId.errors}
            />
          </SectionCard>

          <SectionCard
            id="section-signup-form"
            title="Signup form"
            description="The questions guests answer when signing up."
          >
            <SignupFormBuilder
              field={fields.signupForm}
              lockFieldKeys={lockFieldKeys}
              answerCounts={answerCounts}
            />
          </SectionCard>

          <SaveBar submitText={submitText} cancelHref={cancelHref} />
        </div>
      </div>
    </div>
  );
}
