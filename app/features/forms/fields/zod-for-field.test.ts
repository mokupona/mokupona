import { describe, expect, it } from "vitest";

import { zodForField, type NonListFieldDescriptor } from "./non-list";

import { defaultText } from "~/features/site-text/text";

function descriptor(
  type: Exclude<NonListFieldDescriptor["type"], "select">,
  required: boolean,
): NonListFieldDescriptor {
  return {
    type,
    version: 1,
    data: { name: "field", label: "Field", required },
  };
}

describe("zodForField", () => {
  describe.each(["text", "textarea", "phone"] as const)("%s", (type) => {
    it("trims and accepts a value", () => {
      const schema = zodForField(descriptor(type, true), defaultText);
      expect(schema.parse("  hello  ")).toBe("hello");
    });

    it("rejects an empty value when required", () => {
      const schema = zodForField(descriptor(type, true), defaultText);
      expect(schema.safeParse("   ").success).toBe(false);
      expect(schema.safeParse("").success).toBe(false);
      expect(schema.safeParse(undefined).success).toBe(false);
    });

    it("accepts a missing value when optional", () => {
      const schema = zodForField(descriptor(type, false), defaultText);
      expect(schema.parse(undefined)).toBeUndefined();
    });
  });

  describe("email", () => {
    it("accepts a valid email", () => {
      const schema = zodForField(descriptor("email", true), defaultText);
      expect(schema.parse("a@example.com")).toBe("a@example.com");
    });

    it("trims before validating", () => {
      const schema = zodForField(descriptor("email", true), defaultText);
      expect(schema.parse(" a@example.com ")).toBe("a@example.com");
    });

    it("rejects an invalid email", () => {
      const schema = zodForField(descriptor("email", true), defaultText);
      expect(schema.safeParse("not-an-email").success).toBe(false);
    });

    it("rejects a missing value when required", () => {
      const schema = zodForField(descriptor("email", true), defaultText);
      expect(schema.safeParse(undefined).success).toBe(false);
    });

    it("accepts a missing value when optional", () => {
      const schema = zodForField(descriptor("email", false), defaultText);
      expect(schema.parse(undefined)).toBeUndefined();
    });
  });

  describe("checkbox", () => {
    it("defaults to false when optional and missing", () => {
      const schema = zodForField(descriptor("checkbox", false), defaultText);
      expect(schema.parse(undefined)).toBe(false);
    });

    it("accepts true and false when optional", () => {
      const schema = zodForField(descriptor("checkbox", false), defaultText);
      expect(schema.parse(true)).toBe(true);
      expect(schema.parse(false)).toBe(false);
    });

    it("must be checked when required", () => {
      const schema = zodForField(descriptor("checkbox", true), defaultText);
      expect(schema.parse(true)).toBe(true);
      expect(schema.safeParse(false).success).toBe(false);
      expect(schema.safeParse(undefined).success).toBe(false);
    });
  });
});

describe("zodForField select", () => {
  function selectDescriptor(required: boolean): NonListFieldDescriptor {
    return {
      type: "select",
      version: 1,
      data: {
        name: "menu",
        label: "Menu",
        required,
        options: ["Meat", "Vegan"],
      },
    };
  }

  it("accepts a configured option", () => {
    const schema = zodForField(selectDescriptor(true), defaultText);
    expect(schema.parse("Vegan")).toBe("Vegan");
  });

  it("rejects a value outside the options", () => {
    const schema = zodForField(selectDescriptor(true), defaultText);
    expect(schema.safeParse("Fish").success).toBe(false);
  });

  it("rejects a missing value when required", () => {
    const schema = zodForField(selectDescriptor(true), defaultText);
    expect(schema.safeParse(undefined).success).toBe(false);
  });

  it("accepts a missing value when optional", () => {
    const schema = zodForField(selectDescriptor(false), defaultText);
    expect(schema.parse(undefined)).toBeUndefined();
  });

  it("still rejects a non-option when optional", () => {
    const schema = zodForField(selectDescriptor(false), defaultText);
    expect(schema.safeParse("Fish").success).toBe(false);
  });
});

describe("SelectFieldSchema bounds", () => {
  async function parseSelect(options: string[]) {
    const { SelectFieldSchema } = await import("./select/model");
    return SelectFieldSchema.safeParse({
      type: "select",
      version: 1,
      data: { name: "menu", label: "Menu", required: false, options },
    });
  }

  it("rejects duplicate options (after trimming)", async () => {
    expect((await parseSelect(["Meat", "Meat "])).success).toBe(false);
  });

  it("rejects options containing line breaks", async () => {
    expect((await parseSelect(["A\nB"])).success).toBe(false);
  });

  it("rejects an over-long option", async () => {
    expect((await parseSelect(["x".repeat(101)])).success).toBe(false);
  });

  it("accepts a clean option list", async () => {
    expect((await parseSelect(["Meat", "Vegan"])).success).toBe(true);
  });
});
