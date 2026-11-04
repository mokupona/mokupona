import { describe, expect, it } from "vitest";

import { validateSiteText } from "./validate";

describe("validateSiteText", () => {
  it("trims and folds a one-line text onto one line", () => {
    expect(validateSiteText("signup.heading", "  book\r\n a seat ")).toEqual({
      ok: true,
      value: "book a seat",
    });
  });

  it("keeps the line breaks of a paragraph, as plain newlines", () => {
    expect(
      validateSiteText("landing.vision.body", "first\r\n\r\nsecond\n"),
    ).toEqual({ ok: true, value: "first\n\nsecond" });
  });

  it("refuses a blank text unless it may be left out", () => {
    expect(validateSiteText("signup.heading", "   ")).toMatchObject({
      ok: false,
    });
    expect(validateSiteText("site.error.notFoundMessage", "")).toEqual({
      ok: true,
      value: "",
    });
  });

  it("names the placeholders a text can use when one is misspelt", () => {
    const result = validateSiteText("auth.inbox.body", "sent to {mail}");
    expect(result).toEqual({
      ok: false,
      error: "Unknown placeholder {mail} — this text can use {email}.",
    });
  });

  it("refuses tags a text can't render and unclosed ones", () => {
    expect(validateSiteText("signup.heading", "<b>book</b>")).toMatchObject({
      ok: false,
      error: expect.stringContaining("can't contain tags"),
    });
    expect(
      validateSiteText("signup.privacy", "i agree to the <link>policy"),
    ).toMatchObject({
      ok: false,
      error: expect.stringContaining("needs a matching closing tag"),
    });
  });

  it("caps the length", () => {
    expect(validateSiteText("signup.heading", "a".repeat(501))).toMatchObject({
      ok: false,
      error: "Keep it under 500 characters.",
    });
  });
});
