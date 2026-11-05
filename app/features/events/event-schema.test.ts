import { describe, expect, it } from "vitest";

import { EventEditSchema, EventSchema } from "./event-schema";

describe("event form schemas", () => {
  it("requires a cover on create and permits an omitted cover on edit", () => {
    expect(EventSchema.shape.cover.safeParse(undefined).success).toBe(false);
    expect(EventEditSchema.shape.cover.safeParse(undefined).success).toBe(true);
  });

  it("accepts blank discounts and rejects negative ones", () => {
    const { studentDiscount, vegetarianDiscount } = EventSchema.shape;
    for (const discount of [studentDiscount, vegetarianDiscount]) {
      expect(discount.safeParse(undefined).success).toBe(true);
      expect(discount.safeParse(10).success).toBe(true);
      expect(discount.safeParse(-1).success).toBe(false);
    }
  });

  it("rejects signup mail copy with a placeholder the mail can't fill", () => {
    const { confirmedMailSubject, confirmedMailMessage } = EventSchema.shape;

    expect(confirmedMailSubject.safeParse("See you, {name}").success).toBe(
      true,
    );
    expect(confirmedMailMessage.safeParse(undefined).success).toBe(true);

    const typo = confirmedMailMessage.safeParse("Hi {nmae}");
    expect(typo.success).toBe(false);
    expect(typo.error?.issues[0].message).toMatch(
      /Unknown placeholder \{nmae\}\. Available: \{name\}/,
    );
  });

  it("caps the subject's length", () => {
    expect(
      EventSchema.shape.confirmedMailSubject.safeParse("x".repeat(201)).success,
    ).toBe(false);
  });
});
