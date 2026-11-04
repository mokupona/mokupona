import { FRIEND_EMAIL_FIELD } from "./booking-summary";

import type { FieldDescriptor } from "~/features/forms/fields";

export const DEFAULT_FORM: Array<FieldDescriptor> = [
  {
    type: "text",
    version: 1,
    data: { name: "name", label: "Name", required: true },
  },
  {
    type: "email",
    version: 1,
    data: { name: "email", label: "Email", required: true },
  },
  {
    type: "phone",
    version: 1,
    data: { name: "phone", label: "Phone number", required: true },
  },
  {
    type: "checkbox",
    version: 1,
    data: { name: "vegetarian", label: "Vegan / Vegetarian", required: false },
  },
  {
    type: "checkbox",
    version: 1,
    data: { name: "student", label: "Student", required: false },
  },
  {
    type: "text",
    version: 1,
    data: {
      name: "restrictions",
      label: "Dietary restrictions",
      required: false,
    },
  },
  {
    type: "list",
    version: 1,
    data: {
      name: "friends",
      label: "Friends",
      required: false,
      maxCount: 3,
      addLabel: "Add a friend",
      removeLabel: "Remove this person",
      itemFields: [
        {
          type: "text",
          version: 1,
          data: { name: "name", label: "Name", required: true },
        },
        {
          type: "checkbox",
          version: 1,
          data: {
            name: "vegetarian",
            label: "Vegan / Vegetarian",
            required: false,
          },
        },
        {
          type: "checkbox",
          version: 1,
          data: { name: "student", label: "Student", required: false },
        },
        {
          type: "text",
          version: 1,
          data: {
            name: "restrictions",
            label: "Dietary restrictions",
            required: false,
          },
        },
        {
          type: "email",
          version: 1,
          data: {
            name: FRIEND_EMAIL_FIELD,
            label: "Their email",
            required: false,
            description:
              "Optional. If you add it, they get an email that you signed them up.",
          },
        },
      ],
    },
  },
  {
    type: "textarea",
    version: 1,
    data: { name: "comment", label: "Comment", required: false },
  },
];
