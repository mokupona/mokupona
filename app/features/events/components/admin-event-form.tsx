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
import {
  defaultSignupMailCopy,
  SIGNUP_MAIL_PLACEHOLDERS,
  type SignupMailCopy,
} from "~/features/signup-form/confirmation-mail";
import type { AnswerCountsByFieldKey } from "~/features/signup-form/read.server";
import { useText } from "~/features/site-text/site-text-context";
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

// the event texts and signup messages are Markdown (app/shared/markdown.server.ts)
const MARKDOWN_HINT =
  "Markdown works here: [link text](https://…), **bold**, *italic*, and lines starting with - for a list.";

const SECTIONS = [
  { id: "section-basics", label: "Basics" },
  { id: "section-photo", label: "Photo" },
  { id: "section-menu-donation", label: "Menu & donation" },
  { id: "section-schedule-pricing", label: "Schedule & pricing" },
  { id: "section-location", label: "Location" },
  { id: "section-signup-form", label: "Signup form" },
  { id: "section-signup-email", label: "Signup email" },
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

function SignupMailCopyFields({
  legend,
  description,
  subject,
  message,
  defaults,
}: {
  legend: string;
  description: string;
  subject: AdminEventFormProps["fields"]["confirmedMailSubject"];
  message: AdminEventFormProps["fields"]["confirmedMailMessage"];
  defaults: SignupMailCopy;
}) {
  const form = useFormMetadata();
  const isBlank = !subject.value && !message.value;

  return (
    <fieldset className="flex flex-col gap-4 border-t pt-5 first:border-t-0 first:pt-0">
      <legend className="float-left mb-1 w-full">
        <span className="font-semibold">{legend}</span>
        <span className="text-muted-foreground mt-1 block text-sm">
          {description}
        </span>
      </legend>

      <Field
        labelProps={{ children: "Subject" }}
        inputProps={{
          ...getInputProps(subject, { type: "text" }),
          placeholder: defaults.subject,
        }}
        errors={subject.errors}
      />

      <TextareaField
        labelProps={{ children: "Message" }}
        description={MARKDOWN_HINT}
        textareaProps={{
          ...getTextareaProps(message),
          placeholder: defaults.message,
          rows: 7,
        }}
        errors={message.errors}
      />

      {isBlank ? (
        <div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              form.update({ name: subject.name, value: defaults.subject });
              form.update({ name: message.name, value: defaults.message });
            }}
          >
            Start from the default text
          </Button>
        </div>
      ) : null}
    </fieldset>
  );
}

function SignupMailFields({
  fields,
}: {
  fields: Pick<
    AdminEventFormProps["fields"],
    | "confirmedMailSubject"
    | "confirmedMailMessage"
    | "waitlistMailSubject"
    | "waitlistMailMessage"
  >;
}) {
  // an event without its own copy falls back to the site-wide texts, which
  // admins edit under /admin/texts
  const defaults = defaultSignupMailCopy(useText());

  return (
    <>
      <SignupMailCopyFields
        legend="Seat confirmed"
        description="Sent when a group gets its seats at signup, and when you confirm a group from the waiting list."
        subject={fields.confirmedMailSubject}
        message={fields.confirmedMailMessage}
        defaults={defaults.confirmed}
      />

      <SignupMailCopyFields
        legend="Waiting list"
        description="Sent when there aren't enough seats left for the whole group."
        subject={fields.waitlistMailSubject}
        message={fields.waitlistMailMessage}
        defaults={defaults.waitlisted}
      />

      <div className="flex flex-col gap-2 border-t pt-5 text-sm">
        <p className="text-muted-foreground">
          A blank line starts a new paragraph. The guest list, everyone&apos;s
          answers and the prices are added below the message automatically.
          These placeholders work in subjects and messages:
        </p>
        <ul className="flex flex-col gap-1">
          {Object.entries(SIGNUP_MAIL_PLACEHOLDERS).map(([name, meaning]) => (
            <li key={name}>
              <code className="bg-muted rounded px-1">{`{${name}}`}</code>{" "}
              <span className="text-muted-foreground">{meaning}</span>
            </li>
          ))}
        </ul>
      </div>
    </>
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
              description={MARKDOWN_HINT}
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
              description={MARKDOWN_HINT}
              textareaProps={{
                ...getTextareaProps(fields.menuDescription),
                rows: 10,
              }}
              errors={fields.menuDescription.errors}
            />

            <TextareaField
              labelProps={{ children: "Donation" }}
              description={MARKDOWN_HINT}
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
            description="When it happens, how many seats, and what it costs. Guests who tick “Student” on the signup form pay the student price."
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

              <Field
                className="grow"
                labelProps={{ children: "Student price" }}
                inputProps={{
                  ...getInputProps(fields.studentPrice, { type: "number" }),
                  placeholder: "Full price",
                }}
                errors={fields.studentPrice.errors}
              />
            </div>

            <TextareaField
              labelProps={{ children: "Discounts" }}
              description={MARKDOWN_HINT}
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

          <SectionCard
            id="section-signup-email"
            title="Signup email"
            description="Sent to everyone who signs up, depending on whether they got seats. A blank field uses the default text shown in grey."
          >
            <SignupMailFields fields={fields} />
          </SectionCard>

          <SaveBar submitText={submitText} cancelHref={cancelHref} />
        </div>
      </div>
    </div>
  );
}
