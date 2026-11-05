import { describe, expect, it } from "vitest";

import {
  FRIEND_EMAIL_FIELD,
  formatChf,
  summarizeBooking,
} from "./booking-summary";
import { DEFAULT_FORM } from "./default-form";

import type { FieldDescriptor } from "~/features/forms/fields";
import { defaultText } from "~/features/site-text/text";

const signer = {
  name: "Ada Signer",
  email: "ada@example.com",
  phone: "0791234567",
  vegetarian: true,
  student: false,
  restrictions: "no nuts",
  comment: "",
};

describe("summarizeBooking", () => {
  it("lists the signer first, then each friend, with their own answers", () => {
    const summary = summarizeBooking(
      DEFAULT_FORM,
      {
        ...signer,
        friends: [
          { name: "Grace", vegetarian: false, student: true, restrictions: "" },
        ],
      },
      { price: 45, studentDiscount: null, vegetarianDiscount: null },
      defaultText,
    );

    expect(summary.guests).toEqual([
      {
        name: "Ada Signer",
        isStudent: false,
        vegetarian: true,
        price: 45,
        email: null,
        rows: [
          ["Vegan / Vegetarian", "yes"],
          ["Student", "no"],
          ["Dietary restrictions", "no nuts"],
        ],
      },
      {
        name: "Grace",
        isStudent: true,
        vegetarian: false,
        price: 45,
        email: null,
        rows: [
          ["Vegan / Vegetarian", "no"],
          ["Student", "yes"],
          ["Dietary restrictions", "—"],
        ],
      },
    ]);
  });

  it("reads a friend's email as their address, not as one of their answers", () => {
    const summary = summarizeBooking(
      DEFAULT_FORM,
      {
        ...signer,
        friends: [
          {
            name: "Grace",
            vegetarian: false,
            student: false,
            restrictions: "",
            [FRIEND_EMAIL_FIELD]: "  grace@example.com ",
          },
          { name: "Alan", [FRIEND_EMAIL_FIELD]: "" },
        ],
      },
      { price: 45, studentDiscount: null, vegetarianDiscount: null },
      defaultText,
    );

    expect(summary.guests.map((guest) => guest.email)).toEqual([
      null,
      "grace@example.com",
      null,
    ]);
    expect(summary.guests[1].rows.map(([label]) => label)).not.toContain(
      "Their email",
    );
    expect(summary.contact.map(([label]) => label)).not.toContain(
      "Their email",
    );
  });

  it("marks diet as not asked when the form has no vegetarian question for guests", () => {
    const fields: FieldDescriptor[] = DEFAULT_FORM.map((field) =>
      field.type === "list"
        ? {
            ...field,
            data: {
              ...field.data,
              itemFields: field.data.itemFields.filter(
                (item) => item.data.name !== "vegetarian",
              ),
            },
          }
        : field,
    );

    const summary = summarizeBooking(
      fields,
      { ...signer, friends: [{ name: "Grace" }] },
      { price: 45, studentDiscount: null, vegetarianDiscount: null },
      defaultText,
    );

    expect(summary.guests.map((guest) => guest.vegetarian)).toEqual([
      null,
      null,
    ]);
  });

  it("keeps the signup-wide answers apart from the guests", () => {
    const summary = summarizeBooking(
      DEFAULT_FORM,
      signer,
      { price: 45, studentDiscount: null, vegetarianDiscount: null },
      defaultText,
    );

    expect(summary.contact).toEqual([
      ["Email", "ada@example.com"],
      ["Phone number", "0791234567"],
      ["Comment", "—"],
    ]);
  });

  it("takes the student discount off for students and adds up the party", () => {
    const summary = summarizeBooking(
      DEFAULT_FORM,
      {
        ...signer,
        student: true,
        friends: [
          { name: "Grace", student: false },
          { name: "Alan", student: true },
        ],
      },
      { price: 45, studentDiscount: 15, vegetarianDiscount: null },
      defaultText,
    );

    expect(summary.guests.map((guest) => guest.price)).toEqual([30, 45, 30]);
    expect(summary.total).toBe(105);
  });

  it("stacks the student and vegetarian discounts", () => {
    const summary = summarizeBooking(
      DEFAULT_FORM,
      {
        ...signer,
        student: true,
        vegetarian: true,
        friends: [
          { name: "Grace", student: false, vegetarian: true },
          { name: "Alan", student: true, vegetarian: false },
          { name: "Ken", student: false, vegetarian: false },
        ],
      },
      { price: 45, studentDiscount: 15, vegetarianDiscount: 5 },
      defaultText,
    );

    expect(summary.guests.map((guest) => guest.price)).toEqual([
      25, 40, 30, 45,
    ]);
    expect(summary.total).toBe(140);
  });

  it("never prices a guest below zero", () => {
    const summary = summarizeBooking(
      DEFAULT_FORM,
      { ...signer, student: true, vegetarian: true },
      { price: 10, studentDiscount: 8, vegetarianDiscount: 5 },
      defaultText,
    );

    expect(summary.total).toBe(0);
  });

  it("charges everyone the full price when the event has no discounts", () => {
    const summary = summarizeBooking(
      DEFAULT_FORM,
      { ...signer, student: true, friends: [{ name: "Grace", student: true }] },
      { price: 45, studentDiscount: null, vegetarianDiscount: null },
      defaultText,
    );

    expect(summary.total).toBe(90);
  });

  it("puts custom top-level questions under the signup's details", () => {
    const fields: FieldDescriptor[] = [
      ...DEFAULT_FORM,
      {
        type: "select",
        version: 1,
        data: {
          name: "heardFrom",
          label: "How did you hear about us?",
          required: false,
          options: ["Friends", "Instagram"],
        },
      },
    ];

    const summary = summarizeBooking(
      fields,
      { ...signer, heardFrom: "Instagram" },
      { price: 45, studentDiscount: null, vegetarianDiscount: null },
      defaultText,
    );

    expect(summary.contact).toContainEqual([
      "How did you hear about us?",
      "Instagram",
    ]);
  });

  it("names a guest by position when the stored name is missing", () => {
    const summary = summarizeBooking(
      DEFAULT_FORM,
      { ...signer, friends: [{ name: "  " }, "not an object"] },
      { price: 10, studentDiscount: null, vegetarianDiscount: null },
      defaultText,
    );

    expect(summary.guests.map((guest) => guest.name)).toEqual([
      "Ada Signer",
      "Guest 2",
      "Guest 3",
    ]);
  });
});

describe("formatChf", () => {
  it("reads 0 as free", () => {
    expect(formatChf(0, defaultText)).toBe("free");
    expect(formatChf(45, defaultText)).toBe("45 CHF");
  });
});
