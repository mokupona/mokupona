import { describe, expect, it } from "vitest";

import {
  escapeMarkdown,
  markdownToText,
  renderMarkdown,
  renderOptionalMarkdown,
} from "./markdown.server";

describe("renderMarkdown", () => {
  it("renders links, emphasis and lists", () => {
    expect(
      renderMarkdown(
        "Book at [our site](https://mokupona.ch), **soon** and *quietly*.\n\n- one\n- two",
      ),
    ).toBe(
      [
        '<p>Book at <a href="https://mokupona.ch" target="_blank" rel="noopener noreferrer">our site</a>, <strong>soon</strong> and <em>quietly</em>.</p>',
        "<ul>",
        "<li>one</li>",
        "<li>two</li>",
        "</ul>",
      ].join("\n"),
    );
  });

  it("keeps single line breaks and splits paragraphs on blank lines", () => {
    expect(renderMarkdown("line one\nline two\n\nnext")).toBe(
      "<p>line one<br>\nline two</p>\n<p>next</p>",
    );
  });

  it("still links bare addresses, on https", () => {
    const html = renderMarkdown(
      "see mokupona.ch, https://example.com/a?b=1 or contact@mokupona.ch",
    );

    expect(html).toContain('<a href="https://mokupona.ch"');
    expect(html).toContain('<a href="https://example.com/a?b=1"');
    expect(html).toContain(
      '<a href="mailto:contact@mokupona.ch">contact@mokupona.ch</a>',
    );
  });

  it("adds https to a link typed without a scheme, and keeps site paths", () => {
    expect(renderMarkdown("[site](mokupona.ch)")).toContain(
      'href="https://mokupona.ch"',
    );
    expect(renderMarkdown("[events](/events)")).toBe(
      '<p><a href="/events">events</a></p>',
    );
  });

  it("escapes html and refuses script and data links", () => {
    const html = renderMarkdown(
      '<script>alert(1)</script> <a href="x">y</a> [a](javascript:alert(1)) [b](JAVASCRIPT:alert(1)) [c](data:text/html,x)',
    );

    expect(html).not.toContain("<script");
    expect(html).not.toContain('<a href="x"');
    expect(html).not.toMatch(/href="(javascript|data):/i);
    expect(html).toContain("&lt;script&gt;");
  });

  it("leaves headings, code, quotes, rules and images as text", () => {
    expect(
      renderMarkdown("# menu\n\n    indented\n\n> quote\n\n---\n\n`code`"),
    ).toBe(
      [
        "<p># menu</p>",
        "<p>indented</p>",
        "<p>&gt; quote</p>",
        "<p>---</p>",
        "<p>`code`</p>",
      ].join("\n"),
    );
    expect(renderMarkdown("![photo](https://example.com/a.jpg)")).not.toContain(
      "<img",
    );
  });
});

describe("renderOptionalMarkdown", () => {
  it("is null for a missing or blank text", () => {
    expect(renderOptionalMarkdown(null)).toBeNull();
    expect(renderOptionalMarkdown("  \n ")).toBeNull();
    expect(renderOptionalMarkdown("hi")).toBe("<p>hi</p>");
  });
});

describe("markdownToText", () => {
  it("drops the markup and keeps link labels", () => {
    expect(
      markdownToText("Book at [our site](https://mokupona.ch), **soon**."),
    ).toBe("Book at our site, soon.");
  });

  it("can keep link addresses, but not twice for auto-links", () => {
    expect(
      markdownToText(
        "[our site](https://mokupona.ch/events), mokupona.ch and contact@mokupona.ch",
        { linkUrls: true },
      ),
    ).toBe(
      "our site (https://mokupona.ch/events), mokupona.ch and contact@mokupona.ch",
    );
  });

  it("keeps line breaks, paragraphs and list items", () => {
    expect(
      markdownToText(
        "Hi,\nthere.\n\n- one\n- two\n\n1. first\n2. second\n\nBye",
      ),
    ).toBe("Hi,\nthere.\n\n- one\n- two\n\n1. first\n2. second\n\nBye");
  });

  it("turns escapes back into the characters", () => {
    expect(markdownToText(escapeMarkdown("*Ada* [x](y) 19:00 & co."))).toBe(
      "*Ada* [x](y) 19:00 & co.",
    );
  });
});

describe("escapeMarkdown", () => {
  it("stops typed text from becoming markup or a link", () => {
    expect(
      renderMarkdown(
        `Hi ${escapeMarkdown("[click](https://evil.example) **Ada** mokupona.ch")}`,
      ),
    ).toBe("<p>Hi [click](https://evil.example) **Ada** mokupona.ch</p>");
  });
});
