import { describe, expect, it } from "vitest";

import { withSource } from "./source";

describe("withSource", () => {
  it("tags a link with where it was shared", () => {
    expect(withSource("https://mokupona.ch/events/abc", "qr")).toBe(
      "https://mokupona.ch/events/abc?src=qr",
    );
  });

  it("keeps the link's own query and replaces an earlier tag", () => {
    expect(
      withSource("https://mokupona.ch/events/abc?x=1&src=insta", "qr"),
    ).toBe("https://mokupona.ch/events/abc?x=1&src=qr");
  });
});
