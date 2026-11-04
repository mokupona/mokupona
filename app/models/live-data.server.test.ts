// @vitest-environment node

import { afterAll, describe, expect, it } from "vitest";

import { createTestUser } from "../../test/factories";
import { EMPTY_LIVE_DATA, liveDataFixture } from "../../test/live-data-fixture";

import {
  countLiveDataTables,
  getImageCopiesByIds,
  listAppliedMigrations,
  readLiveDataTables,
  replaceLiveDataTables,
} from "./live-data.server";

import { prisma } from "~/db.server";

afterAll(async () => {
  // leave no fixture events behind for later test files' "next event" checks
  await replaceLiveDataTables(EMPTY_LIVE_DATA);
});

describe("listAppliedMigrations", () => {
  it("lists the finished migrations in order", async () => {
    const migrations = await listAppliedMigrations();

    expect(migrations[0]).toBe("20240106141249_initialize_db");
    expect(migrations).toContain("20260815201845_gallery_image_primitive");
    expect([...migrations].sort()).toEqual(migrations);
  });
});

describe("replaceLiveDataTables", () => {
  it("swaps in the copy and reads back exactly what went in", async () => {
    const creator = await createTestUser("admin");
    const tables = liveDataFixture("roundtrip", {
      createdByEmail: creator.email,
    });

    await replaceLiveDataTables(tables);

    expect(await readLiveDataTables({ includeSignups: true })).toEqual(tables);
    expect(await countLiveDataTables()).toEqual({
      addresses: 1,
      images: 3,
      forms: 1,
      formVersions: 1,
      formSubmissions: 1,
      events: 1,
      eventResponses: 1,
      eventGalleryImages: 1,
      boardMembers: 1,
      volunteers: 1,
      eventVolunteers: 1,
      siteTexts: 1,
    });
  });

  it("leaves users alone and drops a creator this site has no account for", async () => {
    const usersBefore = await prisma.user.count();

    await replaceLiveDataTables(
      liveDataFixture("nocreator", { createdByEmail: "nobody@example.com" }),
    );

    expect(await prisma.user.count()).toBe(usersBefore);
    const { events } = await readLiveDataTables({ includeSignups: true });
    expect(events[0].createdByEmail).toBeNull();
  });

  it("matches the creator's email case-insensitively", async () => {
    const creator = await createTestUser("admin");

    await replaceLiveDataTables(
      liveDataFixture("case", { createdByEmail: creator.email.toUpperCase() }),
    );

    const { events } = await readLiveDataTables({ includeSignups: true });
    expect(events[0].createdByEmail).toBe(creator.email);
  });

  it("hands back the storage keys that were here before", async () => {
    await replaceLiveDataTables(liveDataFixture("first"));

    const { previousStorageKeys } = await replaceLiveDataTables(
      liveDataFixture("second"),
    );

    expect(previousStorageKeys.sort()).toEqual([
      "first-cover-key",
      "first-gallery-key",
      "first-portrait-key",
    ]);
  });

  it("changes nothing when the copy cannot be written", async () => {
    await replaceLiveDataTables(liveDataFixture("intact"));
    const broken = liveDataFixture("broken");
    broken.addresses.push({ ...broken.addresses[0] }); // duplicate primary key

    await expect(replaceLiveDataTables(broken)).rejects.toThrow();

    const { events } = await readLiveDataTables({ includeSignups: true });
    expect(events.map((event) => event.id)).toEqual(["intact_event"]);
  });
});

describe("readLiveDataTables", () => {
  it("leaves guests' signups behind on request", async () => {
    await replaceLiveDataTables(liveDataFixture("private"));

    const tables = await readLiveDataTables({ includeSignups: false });

    expect(tables.formSubmissions).toEqual([]);
    expect(tables.eventResponses).toEqual([]);
    expect(tables.events).toHaveLength(1);
  });
});

describe("getImageCopiesByIds", () => {
  it("returns the stored metadata of the requested images only", async () => {
    await replaceLiveDataTables(liveDataFixture("copies"));

    const copies = await getImageCopiesByIds(["copies_cover", "missing"]);

    expect(copies).toEqual([
      {
        id: "copies_cover",
        storageKey: "copies-cover-key",
        contentType: "image/jpeg",
        version: 11,
        width: 1200,
        height: 800,
        blurDataUrl: null,
      },
    ]);
  });
});
