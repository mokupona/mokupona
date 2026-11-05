import { z } from "zod";

import { SignupFormBuilderSchema } from "~/features/signup-form/builder";
import {
  MAX_SIGNUP_MAIL_MESSAGE_LENGTH,
  MAX_SIGNUP_MAIL_SUBJECT_LENGTH,
  signupMailPlaceholderList,
  unknownSignupMailPlaceholders,
} from "~/features/signup-form/confirmation-mail";
import { imageFileSchema } from "~/shared/image";

// a typo'd placeholder would reach guests as literal "{nmae}", so it fails
// validation instead
function signupMailCopy(maxLength: number) {
  return z
    .string()
    .trim()
    .max(maxLength, `Use at most ${maxLength} characters`)
    .superRefine((value, ctx) => {
      const unknown = unknownSignupMailPlaceholders(value);
      if (unknown.length > 0) {
        ctx.addIssue({
          code: "custom",
          message: `Unknown placeholder ${unknown.join(", ")}. Available: ${signupMailPlaceholderList()}`,
        });
      }
    })
    .optional();
}

export const EventSchema = z.object({
  signupForm: SignupFormBuilderSchema,
  title: z.string({ error: "Title is required" }).trim(),
  description: z.string({ error: "Description is required" }).trim(),
  menuDescription: z.string().trim().optional(),
  donationDescription: z.string().trim().optional(),
  date: z
    .string({ error: "Date is required" })
    .regex(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?$/,
      "Date is required",
    )
    .refine(
      (value) => !Number.isNaN(new Date(value).getTime()),
      "Date is required",
    ),
  slots: z
    .number({ error: "Slots is required" })
    .min(0, "Slots cannot be less than 0")
    .int(),
  price: z
    .number({ error: "Price is required" })
    .min(0, "Price cannot be less than 0")
    .int(),
  studentDiscount: z
    .number()
    .min(0, "Student discount cannot be less than 0")
    .int()
    .optional(),
  vegetarianDiscount: z
    .number()
    .min(0, "Vegetarian discount cannot be less than 0")
    .int()
    .optional(),
  discounts: z.string().trim().optional(),
  confirmedMailSubject: signupMailCopy(MAX_SIGNUP_MAIL_SUBJECT_LENGTH),
  confirmedMailMessage: signupMailCopy(MAX_SIGNUP_MAIL_MESSAGE_LENGTH),
  waitlistMailSubject: signupMailCopy(MAX_SIGNUP_MAIL_SUBJECT_LENGTH),
  waitlistMailMessage: signupMailCopy(MAX_SIGNUP_MAIL_MESSAGE_LENGTH),
  cover: imageFileSchema(),
  addressId: z.string({ error: "Address is required" }).trim(),
});

export const EventEditSchema = EventSchema.partial({ cover: true });
