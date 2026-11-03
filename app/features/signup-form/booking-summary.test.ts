import { describe, expect, it } from "vitest";

import { formatChf, summarizeBooking } from "./booking-summary";
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
      { price: 45, studentPrice: null },
      defaultText,
    );

    expect(summary.guests).toEqual([
      {
        name: "Ada Signer",
        isStudent: false,
        price: 45,
        rows: [
          ["Vegan / Vegetarian", "yes"],
          ["Student", "no"],
          ["Dietary restrictions", "no nuts"],
        ],
      },
      {
        name: "Grace",
        isStudent: true,
        price: 45,
        rows: [
          ["Vegan / Vegetarian", "no"],
          ["Student", "yes"],
          ["Dietary restrictions", "—"],
        ],
      },
    ]);
  });

  it("keeps the signup-wide answers apart from the guests", () => {
    const summary = summarizeBooking(
      DEFAULT_FORM,
      signer,
      {
        price: 45,
        studentPrice: null,
      },
      defaultText,
    );

    expect(summary.contact).toEqual([
      ["Email", "ada@example.com"],
      ["Phone number", "0791234567"],
      ["Comment", "—"],
    ]);
  });

  it("charges students the student price and adds up the party", () => {
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
      { price: 45, studentPrice: 30 },
      defaultText,
    );

    expect(summary.guests.map((guest) => guest.price)).toEqual([30, 45, 30]);
    expect(summary.total).toBe(105);
  });

  it("charges everyone the full price when the event has no student price", () => {
    const summary = summarizeBooking(
      DEFAULT_FORM,
      { ...signer, student: true, friends: [{ name: "Grace", student: true }] },
      { price: 45, studentPrice: null },
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
      { price: 45, studentPrice: null },
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
      { price: 10, studentPrice: null },
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
