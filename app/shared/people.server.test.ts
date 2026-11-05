import { describe, expect, it } from "vitest";

import { toPerson } from "./people.server";

const member = { id: "m1", name: "Ada", image: null };

describe("toPerson", () => {
  it("renders the bio's Markdown, links and all", () => {
    const person = toPerson(
      {
        ...member,
        bio: "Cooks **everything**.\nFind her at [her blog](https://ada.example).",
      },
      "Head chef",
    );

    expect(person).toMatchObject({
      id: "m1",
      name: "Ada",
      subtitle: "Head chef",
    });
    expect(person.bioHtml).toContain("<strong>everything</strong>");
    expect(person.bioHtml).toContain("<br>");
    expect(person.bioHtml).toContain('<a href="https://ada.example"');
  });

  it("keeps a bio written as plain text reading the same", () => {
    expect(
      toPerson({ ...member, bio: "First paragraph.\n\nSecond one." }, null)
        .bioHtml,
    ).toBe("<p>First paragraph.</p>\n<p>Second one.</p>");
  });

  it("escapes html typed into a bio", () => {
    expect(
      toPerson({ ...member, bio: '<img src=x onerror="alert(1)">' }, null)
        .bioHtml,
    ).not.toContain("<img");
  });

  it("has no bio html for an empty bio", () => {
    expect(toPerson({ ...member, bio: null }, null).bioHtml).toBeNull();
    expect(toPerson({ ...member, bio: "  \n " }, null).bioHtml).toBeNull();
  });
});
