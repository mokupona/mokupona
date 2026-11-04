import { describe, expect, it } from "vitest";

import {
  checkTemplate,
  fillTemplate,
  parseTemplate,
  templateNames,
} from "./format";

describe("parseTemplate", () => {
  it("splits text, placeholders and tags", () => {
    expect(parseTemplate("hi {name}, read the <link>policy</link>.")).toEqual([
      { kind: "text", text: "hi " },
      { kind: "var", name: "name" },
      { kind: "text", text: ", read the " },
      {
        kind: "tag",
        name: "link",
        children: [{ kind: "text", text: "policy" }],
      },
      { kind: "text", text: "." },
    ]);
  });

  it("nests placeholders inside tags", () => {
    expect(parseTemplate("<b>{count} seats</b>")).toEqual([
      {
        kind: "tag",
        name: "b",
        children: [
          { kind: "var", name: "count" },
          { kind: "text", text: " seats" },
        ],
      },
    ]);
  });

  it("keeps an unclosed or stray tag as the text that was typed", () => {
    expect(parseTemplate("a <link>b")).toEqual([
      { kind: "text", text: "a <link>b" },
    ]);
    expect(parseTemplate("a </link> b")).toEqual([
      { kind: "text", text: "a </link> b" },
    ]);
  });

  it("leaves things that only look like markup alone", () => {
    expect(parseTemplate("i <3 food, a < b > c")).toEqual([
      { kind: "text", text: "i <3 food, a < b > c" },
    ]);
  });
});

describe("fillTemplate", () => {
  it("fills the placeholders it has values for and keeps the rest", () => {
    expect(fillTemplate("{left} of {slots} seats", { left: 3 })).toBe(
      "3 of {slots} seats",
    );
  });

  it("ignores placeholders named after object internals", () => {
    expect(fillTemplate("{constructor} {name}", { name: "Ada" })).toBe(
      "{constructor} Ada",
    );
  });

  it("returns the template untouched without values", () => {
    expect(fillTemplate("hi {name}")).toBe("hi {name}");
  });
});

describe("checkTemplate", () => {
  it("passes a template that only uses what its page offers", () => {
    expect(
      checkTemplate("hi {email}, see <link>here</link>", {
        vars: ["email"],
        tags: ["link"],
      }),
    ).toEqual({ unknownVars: [], unknownTags: [], unbalancedTags: [] });
  });

  it("reports typos and unbalanced tags", () => {
    expect(
      checkTemplate("{mail} <b>x</b> <link>y", {
        vars: ["email"],
        tags: ["link"],
      }),
    ).toEqual({
      unknownVars: ["{mail}"],
      unknownTags: ["<b>"],
      unbalancedTags: ["<link>"],
    });
  });
});

describe("templateNames", () => {
  it("lists every placeholder and tag once", () => {
    expect(templateNames("{a} {b} {a} <link>{c}</link>")).toEqual({
      vars: ["a", "b", "c"],
      tags: ["link"],
    });
  });
});
