import { describe, expect, it } from "vitest";

import { EventEditSchema, EventSchema } from "./event-schema";

describe("event form schemas", () => {
  it("requires a cover on create and permits an omitted cover on edit", () => {
    expect(EventSchema.shape.cover.safeParse(undefined).success).toBe(false);
    expect(EventEditSchema.shape.cover.safeParse(undefined).success).toBe(true);
  });

  it("accepts a blank student price and rejects a negative one", () => {
    const { studentPrice } = EventSchema.shape;
    expect(studentPrice.safeParse(undefined).success).toBe(true);
    expect(studentPrice.safeParse(30).success).toBe(true);
    expect(studentPrice.safeParse(-1).success).toBe(false);
  });

  it("rejects signup mail copy with a placeholder the mail can't fill", () => {
    const { signupMailSubject, signupMailMessage } = EventSchema.shape;

    expect(signupMailSubject.safeParse("See you, {name}").success).toBe(true);
    expect(signupMailMessage.safeParse(undefined).success).toBe(true);

    const typo = signupMailMessage.safeParse("Hi {nmae}");
    expect(typo.success).toBe(false);
    expect(typo.error?.issues[0].message).toMatch(
      /Unknown placeholder \{nmae\}\. Available: \{name\}/,
    );
  });

  it("caps the subject's length", () => {
    expect(
      EventSchema.shape.signupMailSubject.safeParse("x".repeat(201)).success,
    ).toBe(false);
  });
});
