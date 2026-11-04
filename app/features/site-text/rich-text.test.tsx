import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { RichText } from "./rich-text";
import { SiteTextProvider, useText } from "./site-text-context";

describe("RichText", () => {
  it("wraps tags and fills placeholders with markup", () => {
    const { container } = render(
      <p>
        <RichText
          text="hi {email}, read the <link>policy</link>."
          vars={{ email: <strong>ada@example.com</strong> }}
          tags={{ link: (children) => <a href="/privacy">{children}</a> }}
        />
      </p>,
    );

    expect(container.innerHTML).toBe(
      '<p>hi <strong>ada@example.com</strong>, read the <a href="/privacy">policy</a>.</p>',
    );
  });

  it("shows a placeholder it has nothing for, and the text of an unknown tag", () => {
    const { container } = render(
      <p>
        <RichText text="{who} <b>bold</b>" />
      </p>,
    );
    expect(container.textContent).toBe("{who} bold");
  });
});

function Heading() {
  const t = useText();
  return <h1>{t("signup.heading")}</h1>;
}

describe("useText", () => {
  it("falls back to the defaults outside a provider", () => {
    render(<Heading />);
    expect(screen.getByRole("heading")).toHaveTextContent("reserve your seat");
  });

  it("prefers the admin's edits handed to the provider", () => {
    render(
      <SiteTextProvider overrides={{ "signup.heading": "platz reservieren" }}>
        <Heading />
      </SiteTextProvider>,
    );
    expect(screen.getByRole("heading")).toHaveTextContent("platz reservieren");
  });
});
