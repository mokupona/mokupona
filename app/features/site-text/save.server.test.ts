// @vitest-environment node

import { beforeEach, describe, expect, it } from "vitest";

import { SITE_TEXTS } from "./registry";
import { saveSiteTextCategory } from "./save.server";
import { getSiteTextOverrides, getText } from "./site-text.server";

import { prisma } from "~/db.server";
import { listSiteTexts, saveSiteTexts } from "~/models/site-text.server";

function form(fields: Record<string, string>) {
  const body = new FormData();
  for (const [key, value] of Object.entries(fields)) body.append(key, value);
  return body;
}

beforeEach(async () => {
  await prisma.siteText.deleteMany();
});

describe("saveSiteTextCategory", () => {
  it("stores an edit with the default it was made against", async () => {
    const result = await saveSiteTextCategory(
      "landing",
      form({
        "landing.vision.headline": "food is how we meet",
        "landing.titleCard.scroll":
          SITE_TEXTS["landing.titleCard.scroll"].default,
      }),
    );

    expect(result).toEqual({
      ok: true,
      changedKeys: ["landing.vision.headline"],
    });
    expect(await listSiteTexts()).toMatchObject([
      {
        key: "landing.vision.headline",
        value: "food is how we meet",
        defaultAtEdit: "food as a way to connect",
      },
    ]);
  });

  it("drops the edit once the text is back to its default", async () => {
    await saveSiteTextCategory(
      "landing",
      form({ "landing.vision.headline": "food is how we meet" }),
    );

    const result = await saveSiteTextCategory(
      "landing",
      form({ "landing.vision.headline": "food as a way to connect" }),
    );

    expect(result).toEqual({
      ok: true,
      changedKeys: ["landing.vision.headline"],
    });
    expect(await listSiteTexts()).toEqual([]);
  });

  it("saves nothing while any text in the form is refused", async () => {
    const result = await saveSiteTextCategory(
      "auth",
      form({
        "auth.login.title": "anmelden",
        "auth.inbox.body": "sent to {mail}",
      }),
    );

    expect(result).toEqual({
      ok: false,
      errors: {
        "auth.inbox.body":
          "Unknown placeholder {mail} — this text can use {email}.",
      },
    });
    expect(await listSiteTexts()).toEqual([]);
  });

  it("ignores fields that belong to another category", async () => {
    const result = await saveSiteTextCategory(
      "landing",
      form({ "signup.heading": "sneaky" }),
    );

    expect(result).toEqual({ ok: true, changedKeys: [] });
    expect(await listSiteTexts()).toEqual([]);
  });

  it("files the new default away when an outdated edit is saved again", async () => {
    await saveSiteTexts({
      upserts: [
        {
          key: "landing.vision.headline",
          value: "food is how we meet",
          defaultAtEdit: "an older default",
        },
      ],
      removals: [],
    });

    const result = await saveSiteTextCategory(
      "landing",
      form({ "landing.vision.headline": "food is how we meet" }),
    );

    expect(result).toEqual({
      ok: true,
      changedKeys: ["landing.vision.headline"],
    });
    expect((await listSiteTexts())[0]?.defaultAtEdit).toBe(
      "food as a way to connect",
    );
  });
});

describe("reading the texts back", () => {
  it("serves edits and skips rows the code no longer knows", async () => {
    await saveSiteTexts({
      upserts: [
        {
          key: "signup.heading",
          value: "platz reservieren",
          defaultAtEdit: "",
        },
        { key: "gone.since.long", value: "stale", defaultAtEdit: "" },
      ],
      removals: [],
    });

    expect(await getSiteTextOverrides()).toEqual({
      "signup.heading": "platz reservieren",
    });

    const t = await getText();
    expect(t("signup.heading")).toBe("platz reservieren");
    expect(t("signup.submit")).toBe("join this event");
  });
});
