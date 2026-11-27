import { describe, expect, it } from "vitest";

import {
  escapeMarkdown,
  markdownToText,
  renderMailMarkdown,
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

describe("renderMailMarkdown", () => {
  const image = "https://res.cloudinary.com/demo/image/upload/q_auto/v1/a";

  it("renders images, styled to fit the mail", () => {
    expect(renderMailMarkdown(`Look:\n\n![the menu](${image})`)).toBe(
      [
        "<p>Look:</p>",
        `<p><img src="${image}" alt="the menu" style="max-width: 100%; height: auto; border: 0;"></p>`,
      ].join("\n"),
    );
  });

  it("renders the rest of the Markdown as a page would", () => {
    const source = "Book at [our site](https://mokupona.ch), **soon**.";
    expect(renderMailMarkdown(source)).toBe(renderMarkdown(source));
  });

  it("escapes the description and drops the title", () => {
    expect(
      renderMailMarkdown(`![a "quote" <b> **bold**](${image} "title")`),
    ).toBe(
      `<p><img src="${image}" alt="a &quot;quote&quot; &lt;b&gt; bold" style="max-width: 100%; height: auto; border: 0;"></p>`,
    );
  });

  it("leaves out images without a full web address", () => {
    expect(renderMailMarkdown("Hi\n\n![Uploading image.png…]()")).toBe(
      "<p>Hi</p>",
    );
    expect(renderMailMarkdown("![photo](/file/abc) there")).toBe(
      "<p> there</p>",
    );
    expect(renderMailMarkdown("![x](javascript:alert(1))")).not.toContain(
      "<img",
    );
    expect(renderMailMarkdown("![x](data:image/png;base64,AAA)")).not.toContain(
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

  it("reads a mail's images as their description, and address with linkUrls", () => {
    const image = "https://example.com/a.png";
    const source = `Menu: ![the **card**](${image}) and ![](${image})\n\n![](/file/a)`;

    expect(markdownToText(source, { images: true, linkUrls: true })).toBe(
      `Menu: the card (${image}) and ${image}`,
    );
    expect(markdownToText(source, { images: true })).toBe("Menu: the card and");
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
