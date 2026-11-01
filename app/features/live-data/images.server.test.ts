// @vitest-environment node

import { describe, expect, it, vi } from "vitest";

import { liveDataFixture } from "../../../test/live-data-fixture";

import {
  chooseImageStrategy,
  copyImages,
  imageFolders,
  sourceImageUrl,
  withoutImages,
  type CopyImagesDeps,
} from "./images.server";
import type { LiveDataSource } from "./snapshot";

const cloudSource: LiveDataSource = {
  schemaVersion: null,
  imageProvider: "cloudinary",
  cloudinaryCloudName: "mokupona",
};

const localSource: LiveDataSource = {
  schemaVersion: null,
  imageProvider: "local",
  cloudinaryCloudName: null,
};

describe("chooseImageStrategy", () => {
  it("shares only when both sites read from the same cloud", () => {
    expect(
      chooseImageStrategy(cloudSource, {
        imageProvider: "cloudinary",
        cloudinaryCloudName: "mokupona",
      }),
    ).toBe("share");
  });

  it.each([
    [cloudSource, { imageProvider: "local", cloudinaryCloudName: "mokupona" }],
    [
      cloudSource,
      { imageProvider: "cloudinary", cloudinaryCloudName: "other" },
    ],
    [localSource, { imageProvider: "cloudinary", cloudinaryCloudName: null }],
    [localSource, { imageProvider: "local", cloudinaryCloudName: null }],
  ] as const)("copies otherwise (%#)", (source, target) => {
    expect(chooseImageStrategy(source, target)).toBe("copy");
  });
});

describe("sourceImageUrl", () => {
  const image = { id: "img 1", storageKey: "abc123", version: 7 };

  it("points at the untransformed Cloudinary original", () => {
    expect(sourceImageUrl(image, cloudSource, "https://mokupona.ch")).toBe(
      "https://res.cloudinary.com/mokupona/image/upload/v7/abc123",
    );
    expect(
      sourceImageUrl({ ...image, version: null }, cloudSource, "https://x"),
    ).toBe("https://res.cloudinary.com/mokupona/image/upload/abc123");
  });

  it("uses the live site's file route for local storage", () => {
    expect(sourceImageUrl(image, localSource, "https://mokupona.ch")).toBe(
      "https://mokupona.ch/file/img%201",
    );
  });
});

describe("imageFolders", () => {
  it("files each image under what shows it, the cover slot winning", () => {
    const tables = liveDataFixture("folders");
    tables.eventGalleryImages.push({
      ...tables.eventGalleryImages[0],
      id: "folders_cover_in_gallery",
      imageId: "folders_cover",
    });

    expect(Object.fromEntries(imageFolders(tables))).toEqual({
      folders_cover: "events",
      folders_portrait: "board-members",
      folders_gallery: "event-gallery",
    });
  });
});

describe("withoutImages", () => {
  it("drops the images and every reference to them", () => {
    const tables = liveDataFixture("drop");

    const result = withoutImages(
      tables,
      new Set(["drop_cover", "drop_gallery", "drop_portrait"]),
    );

    expect(result.images).toEqual([]);
    expect(result.events[0].imageId).toBeNull();
    expect(result.boardMembers[0].imageId).toBeNull();
    expect(result.eventGalleryImages).toEqual([]);
    expect(result.events[0].title).toBe(tables.events[0].title);
  });

  it("returns the tables untouched when nothing failed", () => {
    const tables = liveDataFixture("keep");
    expect(withoutImages(tables, new Set())).toBe(tables);
  });
});

describe("copyImages", () => {
  const tables = liveDataFixture("copy");

  function deps(overrides: Partial<CopyImagesDeps> = {}): CopyImagesDeps {
    let counter = 0;
    return {
      fetch: vi.fn(
        async () =>
          new Response(new Uint8Array([1, 2, 3]), {
            headers: { "content-type": "image/webp" },
          }),
      ) as unknown as typeof fetch,
      store: vi.fn(async () => ({
        storageKey: `stored-${++counter}`,
        width: 10,
        height: 20,
      })),
      previousCopies: new Map(),
      copyStillPresent: vi.fn(async () => true),
      ...overrides,
    };
  }

  function run(d: CopyImagesDeps) {
    return copyImages(
      {
        images: tables.images,
        folders: imageFolders(tables),
        source: cloudSource,
        sourceOrigin: "https://mokupona.ch",
      },
      d,
    );
  }

  it("downloads and stores every image under this site's provider", async () => {
    const d = deps();

    const result = await run(d);

    expect(result.copied).toBe(3);
    expect(result.failed).toEqual([]);
    expect(result.storedKeys).toHaveLength(3);
    expect(d.store).toHaveBeenCalledWith(expect.any(File), "events");
    expect(d.store).toHaveBeenCalledWith(expect.any(File), "board-members");
    expect(d.store).toHaveBeenCalledWith(expect.any(File), "event-gallery");

    const cover = result.images.find((image) => image.id === "copy_cover");
    expect(cover).toMatchObject({
      altText: "A long table",
      contentType: "image/webp",
      version: null,
      width: 10,
      height: 20,
    });
    expect(cover?.storageKey).toMatch(/^stored-/);
  });

  it("reuses an earlier copy instead of downloading again", async () => {
    const d = deps({
      previousCopies: new Map([
        [
          "copy_cover",
          {
            storageKey: "copied-earlier",
            contentType: "image/jpeg",
            version: null,
            width: 1200,
            height: 800,
            blurDataUrl: null,
          },
        ],
      ]),
    });

    const result = await run(d);

    expect(result.reused).toBe(1);
    expect(result.copied).toBe(2);
    expect(result.storedKeys).not.toContain("copied-earlier");
    expect(
      result.images.find((image) => image.id === "copy_cover")?.storageKey,
    ).toBe("copied-earlier");
  });

  it("downloads again when the earlier row was shared, not copied", async () => {
    const d = deps({
      previousCopies: new Map([
        [
          "copy_cover",
          {
            storageKey: "copy-cover-key", // the live site's own key
            contentType: "image/jpeg",
            version: 11,
            width: 1200,
            height: 800,
            blurDataUrl: null,
          },
        ],
      ]),
    });

    const result = await run(d);

    expect(result.reused).toBe(0);
    expect(result.copied).toBe(3);
  });

  it("downloads again when the earlier copy's bytes are gone", async () => {
    const d = deps({
      previousCopies: new Map([
        [
          "copy_cover",
          {
            storageKey: "copied-earlier",
            contentType: "image/jpeg",
            version: null,
            width: null,
            height: null,
            blurDataUrl: null,
          },
        ],
      ]),
      copyStillPresent: vi.fn(async () => false),
    });

    expect((await run(d)).reused).toBe(0);
  });

  it("reports images that could not be downloaded without failing the rest", async () => {
    const fetchMock = vi.fn(async (url: string) =>
      url.includes("copy-gallery-key")
        ? new Response("gone", { status: 404 })
        : new Response(new Uint8Array([1])),
    );

    const result = await run(
      deps({ fetch: fetchMock as unknown as typeof fetch }),
    );

    expect(result.failed.map(({ id }) => id)).toEqual(["copy_gallery"]);
    expect(result.images.map((image) => image.id).sort()).toEqual([
      "copy_cover",
      "copy_portrait",
    ]);
  });
});
