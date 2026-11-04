import { describe, expect, it } from "vitest";

import { createDisplayNameSchema, createEmailSchema } from "./form-schemas";

import { createText, defaultText } from "~/features/site-text/text";

describe("shared auth form schemas", () => {
  it("trims display names and rejects blank values", () => {
    const schema = createDisplayNameSchema(defaultText);
    expect(schema.parse("  Ada  ")).toBe("Ada");
    expect(schema.safeParse("   ").success).toBe(false);
  });

  it("accepts valid email addresses and rejects malformed ones", () => {
    const schema = createEmailSchema(defaultText);
    expect(schema.safeParse("ada@example.com").success).toBe(true);
    expect(schema.safeParse("not-an-email").success).toBe(false);
  });

  it("reports problems in the admin's words", () => {
    const t = createText({ "auth.validation.nameRequired": "Wie heisst du?" });
    const result = createDisplayNameSchema(t).safeParse("");
    expect(result.error?.issues[0]?.message).toBe("Wie heisst du?");
  });
});
