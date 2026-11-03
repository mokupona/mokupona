import { describe, expect, it } from "vitest";

import { isSafeHref, parseDocument, parseInline } from "./document";

describe("parseDocument", () => {
  it("builds sections, sub-sections, paragraphs and lists", () => {
    const sections = parseDocument(
      [
        "## Contact",
        "",
        "moku pona",
        "Zürich",
        "",
        "## Cookies",
        "",
        "### What we store",
        "",
        "We store:",
        "",
        "1. Login information",
        "2. Nothing else",
        "",
        "- a bullet",
      ].join("\n"),
    );

    expect(sections).toEqual([
      {
        title: "Contact",
        blocks: [
          {
            kind: "paragraph",
            content: [
              { kind: "text", text: "moku pona" },
              { kind: "break" },
              { kind: "text", text: "Zürich" },
            ],
          },
        ],
        subsections: [],
      },
      {
        title: "Cookies",
        blocks: [],
        subsections: [
          {
            title: "What we store",
            blocks: [
              {
                kind: "paragraph",
                content: [{ kind: "text", text: "We store:" }],
              },
              {
                kind: "list",
                ordered: true,
                items: [
                  [{ kind: "text", text: "Login information" }],
                  [{ kind: "text", text: "Nothing else" }],
                ],
              },
              {
                kind: "list",
                ordered: false,
                items: [[{ kind: "text", text: "a bullet" }]],
              },
            ],
          },
        ],
      },
    ]);
  });

  it("keeps text written before the first heading", () => {
    const [intro] = parseDocument("Just a paragraph.\r\n\r\n## Then a section");
    expect(intro).toEqual({
      title: null,
      blocks: [
        {
          kind: "paragraph",
          content: [{ kind: "text", text: "Just a paragraph." }],
        },
      ],
      subsections: [],
    });
  });

  it("returns nothing for an empty document", () => {
    expect(parseDocument("  \n\n ")).toEqual([]);
  });
});

describe("parseInline", () => {
  it("turns links and bold text into nodes", () => {
    expect(
      parseInline("see our [privacy policy](/privacy) and **this**"),
    ).toEqual([
      { kind: "text", text: "see our " },
      {
        kind: "link",
        href: "/privacy",
        children: [{ kind: "text", text: "privacy policy" }],
      },
      { kind: "text", text: " and " },
      { kind: "bold", children: [{ kind: "text", text: "this" }] },
    ]);
  });

  it("leaves a link with an unsafe address as plain text", () => {
    expect(parseInline("[click](javascript:alert(1))")).toEqual([
      { kind: "text", text: "[click](javascript:alert(1))" },
    ]);
  });
});

describe("isSafeHref", () => {
  it.each([
    "/privacy",
    "#top",
    "https://mokupona.ch",
    "mailto:a@b.ch",
    "tel:+41",
  ])("allows %s", (href) => expect(isSafeHref(href)).toBe(true));

  it.each([
    "javascript:alert(1)",
    "//evil.example",
    "data:text/html,x",
    "ftp://x",
  ])("refuses %s", (href) => expect(isSafeHref(href)).toBe(false));
});
