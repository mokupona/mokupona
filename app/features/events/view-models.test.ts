import { describe, expect, it } from "vitest";

import { eventStoryHtml } from "./view-models";

const now = new Date("2026-11-09T12:00:00.000Z");
const past = new Date("2026-11-01T18:00:00.000Z");
const upcoming = new Date("2026-11-20T18:00:00.000Z");

const texts = {
  descriptionHtml: "<p>Sign up below!</p>",
  recapHtml: "<p>Thank you for a lovely evening.</p>",
};

describe("eventStoryHtml", () => {
  it("shows the description while the dinner is still ahead", () => {
    expect(eventStoryHtml({ ...texts, date: upcoming }, now)).toBe(
      texts.descriptionHtml,
    );
  });

  it("shows the recap once the dinner is over", () => {
    expect(eventStoryHtml({ ...texts, date: past }, now)).toBe(texts.recapHtml);
    // the loader's date arrives as a string in the browser
    expect(eventStoryHtml({ ...texts, date: past.toISOString() }, now)).toBe(
      texts.recapHtml,
    );
  });

  it("keeps the description for a past dinner without a recap", () => {
    expect(eventStoryHtml({ ...texts, recapHtml: null, date: past }, now)).toBe(
      texts.descriptionHtml,
    );
  });
});
