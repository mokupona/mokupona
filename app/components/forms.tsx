import { ChevronDownIcon } from "lucide-react";
import React, { useId } from "react";

import { Checkbox } from "./ui/checkbox";
import { fieldShellClassName, Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";

import { cn } from "~/lib/utils";

export type ListOfErrors = (string | null | undefined)[] | null | undefined;

export const fileFieldClassName =
  "h-auto cursor-pointer rounded-lg border-dashed border-foreground/20 py-6 text-center transition-colors hover:border-primary/35 file:font-semibold";

export type FieldProps = {
  labelProps: React.ComponentProps<"label">;
  description?: string;
  errors?: ListOfErrors;
  className?: string;
};

function useFieldIds(
  id: string | undefined,
  errors?: ListOfErrors,
  description?: string,
  ariaDescribedBy?: string,
) {
  const fallbackId = useId();
  const resolvedId = id ?? fallbackId;
  const errorId = errors?.length ? `${resolvedId}-error` : undefined;
  const descriptionId = description ? `${resolvedId}-description` : undefined;

  // Conform's prop helpers put their own aria-describedby on the control as
  // soon as it is invalid, so the ids are merged rather than overwritten in
  // either direction; its error id is ours, hence the dedupe.
  const ids = new Set(
    [descriptionId, errorId, ariaDescribedBy]
      .filter((value) => Boolean(value))
      .flatMap((value) => value!.split(" ")),
  );

  const describedBy = [...ids].join(" ") || undefined;

  return { id: resolvedId, errorId, descriptionId, describedBy };
}

export function FieldDescription({
  id,
  children,
  className,
}: {
  id?: string;
  children?: React.ReactNode;
  className?: string;
}) {
  if (!children) return null;
  return (
    <p
      id={id}
      className={cn(
        "text-muted-foreground text-sm whitespace-pre-line",
        className,
      )}
    >
      {children}
    </p>
  );
}

export function ErrorList({
  id,
  errors,
}: {
  id?: string;
  errors?: ListOfErrors;
}) {
  const errorsToRender = errors?.filter(Boolean);
  if (!errorsToRender?.length) return null;
  return (
    <ul id={id} className="flex flex-col gap-1">
      {errorsToRender.map((e) => (
        <li key={e} className="text-destructive-light text-sm">
          {e}
        </li>
      ))}
    </ul>
  );
}

export function Field({
  labelProps,
  inputProps,
  description,
  errors,
  className,
}: FieldProps & {
  inputProps: React.InputHTMLAttributes<HTMLInputElement>;
}) {
  const { id, errorId, descriptionId, describedBy } = useFieldIds(
    inputProps.id,
    errors,
    description,
    inputProps["aria-describedby"],
  );

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <Label htmlFor={id} {...labelProps} />
      <FieldDescription id={descriptionId}>{description}</FieldDescription>
      <Input
        id={id}
        aria-invalid={errorId ? true : undefined}
        {...inputProps}
        aria-describedby={describedBy}
      />
      {errorId ? <ErrorList id={errorId} errors={errors} /> : null}
    </div>
  );
}

export function TextareaField({
  labelProps,
  textareaProps,
  description,
  errors,
  className,
}: FieldProps & {
  textareaProps: React.TextareaHTMLAttributes<HTMLTextAreaElement>;
}) {
  const { id, errorId, descriptionId, describedBy } = useFieldIds(
    textareaProps.id,
    errors,
    description,
    textareaProps["aria-describedby"],
  );

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <Label htmlFor={id} {...labelProps} />
      <FieldDescription id={descriptionId}>{description}</FieldDescription>
      <Textarea
        id={id}
        aria-invalid={errorId ? true : undefined}
        {...textareaProps}
        aria-describedby={describedBy}
      />
      {errorId ? <ErrorList id={errorId} errors={errors} /> : null}
    </div>
  );
}

export function SelectField({
  labelProps,
  selectProps,
  description,
  errors,
  className,
}: FieldProps & {
  selectProps: React.SelectHTMLAttributes<HTMLSelectElement> & {
    options?: Array<{ label: string; value: string }>;
  };
}) {
  const { id, errorId, descriptionId, describedBy } = useFieldIds(
    selectProps.id,
    errors,
    description,
    selectProps["aria-describedby"],
  );

  const {
    children,
    options,
    className: selectClassName,
    ...props
  } = selectProps;

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <Label htmlFor={id} {...labelProps} />
      <FieldDescription id={descriptionId}>{description}</FieldDescription>
      <div className="relative">
        <select
          id={id}
          aria-invalid={errorId ? true : undefined}
          className={cn(
            fieldShellClassName,
            "focus-visible:inset-ring-ring flex w-full appearance-none py-1 pr-9 focus-visible:border-0 focus-visible:inset-ring-2 focus-visible:outline-hidden disabled:cursor-not-allowed disabled:opacity-50",
            selectClassName,
          )}
          {...props}
          aria-describedby={describedBy}
        >
          {options?.map(({ label, value }) => (
            <option key={value} value={value}>
              {label}
            </option>
          )) ?? children}
        </select>
        <ChevronDownIcon
          aria-hidden
          className="text-muted-foreground pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2"
        />
      </div>
      {errorId ? <ErrorList id={errorId} errors={errors} /> : null}
    </div>
  );
}

export function CheckboxField({
  labelProps,
  buttonProps,
  description,
  errors,
  className,
}: FieldProps & {
  buttonProps: React.ComponentProps<"input"> & { name: string };
}) {
  const { id, errorId, descriptionId, describedBy } = useFieldIds(
    buttonProps.id,
    errors,
    description,
    buttonProps["aria-describedby"],
  );

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex items-center gap-2">
        <Checkbox
          {...buttonProps}
          id={id}
          aria-invalid={errorId ? true : undefined}
          aria-describedby={describedBy}
        />
        <Label
          htmlFor={id}
          {...labelProps}
          className={cn(
            "text-foreground/80 text-sm leading-snug font-normal",
            labelProps.className,
          )}
        />
      </div>
      <FieldDescription id={descriptionId} className="pl-6">
        {description}
      </FieldDescription>
      {errorId ? <ErrorList id={errorId} errors={errors} /> : null}
    </div>
  );
}
