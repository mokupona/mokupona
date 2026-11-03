import { describe, expect, it } from "vitest";

import { buildSubmissionSchema } from "./build-submission-schema";
import type { FieldDescriptor } from "./fields";

import { defaultText } from "~/features/site-text/text";

const FIELDS: Array<FieldDescriptor> = [
  {
    type: "text",
    version: 1,
    data: { name: "title", label: "Title", required: true },
  },
  {
    type: "email",
    version: 1,
    data: { name: "contact", label: "Contact", required: true },
  },
  {
    type: "checkbox",
    version: 1,
    data: { name: "subscribed", label: "Subscribed", required: false },
  },
  {
    type: "list",
    version: 1,
    data: {
      name: "entries",
      label: "Entries",
      required: false,
      maxCount: 2,
      addLabel: "Add entry",
      removeLabel: "Remove entry",
      itemFields: [
        {
          type: "text",
          version: 1,
          data: { name: "title", label: "Title", required: true },
        },
        {
          type: "checkbox",
          version: 1,
          data: { name: "subscribed", label: "Subscribed", required: false },
        },
      ],
    },
  },
];

function withListData(
  overrides: Partial<Extract<FieldDescriptor, { type: "list" }>["data"]>,
) {
  return FIELDS.map((field) =>
    field.type === "list"
      ? { ...field, data: { ...field.data, ...overrides } }
      : field,
  );
}

describe("buildSubmissionSchema", () => {
  it("accepts a valid submission and applies defaults", () => {
    const schema = buildSubmissionSchema(FIELDS, defaultText);
    const result = schema.parse({
      title: " Hello ",
      contact: "a@example.com",
      entries: [{ title: "First" }],
    });

    expect(result).toEqual({
      title: "Hello",
      contact: "a@example.com",
      subscribed: false,
      entries: [{ title: "First", subscribed: false }],
    });
  });

  it("rejects a missing required top-level field", () => {
    const schema = buildSubmissionSchema(FIELDS, defaultText);
    const result = schema.safeParse({
      contact: "a@example.com",
      entries: [],
    });

    expect(result.success).toBe(false);
  });

  it("rejects a missing required field inside a list item", () => {
    const schema = buildSubmissionSchema(FIELDS, defaultText);
    const result = schema.safeParse({
      title: "Hello",
      contact: "a@example.com",
      entries: [{ subscribed: true }],
    });

    expect(result.success).toBe(false);
  });

  it("rejects more list items than maxCount with a readable message", () => {
    const schema = buildSubmissionSchema(FIELDS, defaultText);
    const result = schema.safeParse({
      title: "Hello",
      contact: "a@example.com",
      entries: [{ title: "1" }, { title: "2" }, { title: "3" }],
    });

    expect(result.success).toBe(false);
    if (result.success) throw new Error("unreachable");
    expect(result.error.issues[0].message).toBe(
      "Entries can have at most 2 entries",
    );
  });

  it("accepts only an empty list when maxCount is 0", () => {
    const schema = buildSubmissionSchema(
      withListData({ maxCount: 0 }),
      defaultText,
    );

    expect(
      schema.safeParse({
        title: "Hello",
        contact: "a@example.com",
        entries: [],
      }).success,
    ).toBe(true);
    expect(
      schema.safeParse({
        title: "Hello",
        contact: "a@example.com",
        entries: [{ title: "First" }],
      }).success,
    ).toBe(false);
  });

  it("requires at least one item when the list is required", () => {
    const schema = buildSubmissionSchema(
      withListData({ required: true }),
      defaultText,
    );

    expect(
      schema.safeParse({
        title: "Hello",
        contact: "a@example.com",
        entries: [],
      }).success,
    ).toBe(false);
    expect(
      schema.safeParse({
        title: "Hello",
        contact: "a@example.com",
        entries: [{ title: "First" }],
      }).success,
    ).toBe(true);
  });
});
