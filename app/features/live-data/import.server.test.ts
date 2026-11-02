// @vitest-environment node

import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import {
  EMPTY_LIVE_DATA,
  liveDataFixture,
} from "../../../test/live-data-fixture";

import type { LiveDataSetup } from "./config.server";
import {
  checkLiveDataSource,
  importLiveData,
  LiveDataImportError,
  schemaProblem,
  type ImportDeps,
} from "./import.server";
import {
  countLiveDataRows,
  LIVE_DATA_FORMAT,
  LIVE_DATA_FORMAT_VERSION,
  type LiveDataTables,
} from "./snapshot";

import {
  listAppliedMigrations,
  readLiveDataTables,
  replaceLiveDataTables,
} from "~/models/live-data.server";

const setup: Extract<LiveDataSetup, { mode: "target" }> = {
  mode: "target",
  token: "t".repeat(64),
  sourceOrigin: "https://mokupona.ch",
};
const OWN_ORIGIN = "https://staging.mokupona.ch";

async function latestMigration() {
  return (await listAppliedMigrations()).at(-1) ?? null;
}

async function snapshotBody(
  tables: LiveDataTables,
  overrides: Record<string, unknown> = {},
) {
  // the wire form: dates as ISO strings, exactly what the export serves
  return JSON.parse(
    JSON.stringify({
      format: LIVE_DATA_FORMAT,
      formatVersion: LIVE_DATA_FORMAT_VERSION,
      exportedAt: new Date(),
      includesSignups: true,
      source: {
        schemaVersion: await latestMigration(),
        imageProvider: "cloudinary",
        cloudinaryCloudName: "mokupona",
      },
      counts: countLiveDataRows(tables),
      data: tables,
      ...overrides,
    }),
  ) as unknown;
}

function fakeSource(
  body: unknown,
  {
    status = 200,
    headers = {},
  }: { status?: number; headers?: HeadersInit } = {},
) {
  return vi.fn(async (url: string | URL | Request) => {
    const href = String(url);
    if (href.startsWith("https://res.cloudinary.com/")) {
      return new Response(new Uint8Array([1, 2, 3]), {
        headers: { "content-type": "image/jpeg" },
      });
    }
    return status === 200
      ? Response.json(body)
      : new Response(null, { status, headers });
  });
}

function deps(fetchImpl: ReturnType<typeof fakeSource>): ImportDeps & {
  store: ReturnType<typeof vi.fn>;
  destroy: ReturnType<typeof vi.fn>;
} {
  let counter = 0;
  return {
    fetch: fetchImpl as unknown as typeof fetch,
    store: vi.fn(async () => ({ storageKey: `copied-${++counter}` })),
    destroy: vi.fn(async () => {}),
    copyStillPresent: async () => true,
  };
}

function shareImages() {
  vi.stubEnv("IMAGE_PROVIDER", "cloudinary");
  vi.stubEnv("CLOUDINARY_CLOUD_NAME", "mokupona");
}

beforeEach(async () => {
  await replaceLiveDataTables(liveDataFixture("staging"));
});

afterEach(() => {
  vi.unstubAllEnvs();
});

afterAll(async () => {
  await replaceLiveDataTables(EMPTY_LIVE_DATA);
});

describe("schemaProblem", () => {
  it("accepts a source schema this site has applied", () => {
    expect(schemaProblem("b", ["a", "b", "c"])).toBeNull();
    expect(schemaProblem(null, ["a"])).toBeNull();
  });

  it("refuses a source schema newer than this site's", () => {
    expect(schemaProblem("d", ["a", "b"])).toMatch(/Deploy the latest code/);
  });
});

describe("importLiveData", () => {
  it("replaces this site's content and shares images on the same cloud", async () => {
    shareImages();
    const live = liveDataFixture("live");
    const d = deps(fakeSource(await snapshotBody(live)));

    const result = await importLiveData(
      { setup, ownOrigin: OWN_ORIGIN, includeSignups: true },
      d,
    );

    expect(await readLiveDataTables({ includeSignups: true })).toEqual(live);
    expect(result.images).toEqual({
      strategy: "share",
      copied: 0,
      reused: 0,
      failed: 0,
    });
    expect(d.fetch).toHaveBeenCalledTimes(1);
    expect(d.fetch).toHaveBeenCalledWith(
      "https://mokupona.ch/api/live-data?signups=1",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: `Bearer ${setup.token}`,
        }),
        redirect: "manual",
      }),
    );
    expect(d.store).not.toHaveBeenCalled();
    expect(d.destroy).toHaveBeenLastCalledWith(
      expect.arrayContaining([
        "staging-cover-key",
        "staging-gallery-key",
        "staging-portrait-key",
      ]),
    );
  });

  it("asks the live site to leave signups behind", async () => {
    shareImages();
    const fetchImpl = fakeSource(await snapshotBody(liveDataFixture("live")));

    await importLiveData(
      { setup, ownOrigin: OWN_ORIGIN, includeSignups: false },
      deps(fetchImpl),
    );

    expect(fetchImpl.mock.calls[0][0]).toBe(
      "https://mokupona.ch/api/live-data?signups=0",
    );
  });

  it("downloads images into this site's storage when the clouds differ", async () => {
    const live = liveDataFixture("live");
    const d = deps(fakeSource(await snapshotBody(live)));

    const result = await importLiveData(
      { setup, ownOrigin: OWN_ORIGIN, includeSignups: true },
      d,
    );

    expect(result.images).toMatchObject({ strategy: "copy", copied: 3 });
    expect(d.fetch).toHaveBeenCalledWith(
      "https://res.cloudinary.com/mokupona/image/upload/v11/live-cover-key",
      expect.anything(),
    );
    const { images } = await readLiveDataTables({ includeSignups: true });
    expect(images.map((image) => image.storageKey).sort()).toEqual([
      "copied-1",
      "copied-2",
      "copied-3",
    ]);
  });

  it("refuses a live site on a newer schema without touching anything", async () => {
    const before = await readLiveDataTables({ includeSignups: true });
    const body = await snapshotBody(liveDataFixture("live"), {
      source: {
        schemaVersion: "29991231235959_from_the_future",
        imageProvider: "cloudinary",
        cloudinaryCloudName: "mokupona",
      },
    });

    await expect(
      importLiveData(
        { setup, ownOrigin: OWN_ORIGIN, includeSignups: true },
        deps(fakeSource(body)),
      ),
    ).rejects.toThrow(/from_the_future/);
    expect(await readLiveDataTables({ includeSignups: true })).toEqual(before);
  });

  it("destroys its fresh copies again when the database write fails", async () => {
    const broken = liveDataFixture("live");
    broken.addresses.push({ ...broken.addresses[0] });
    const d = deps(fakeSource(await snapshotBody(broken)));

    await expect(
      importLiveData({ setup, ownOrigin: OWN_ORIGIN, includeSignups: true }, d),
    ).rejects.toThrow();

    expect(d.destroy).toHaveBeenCalledWith([
      "copied-1",
      "copied-2",
      "copied-3",
    ]);
    const { events } = await readLiveDataTables({ includeSignups: true });
    expect(events.map((event) => event.id)).toEqual(["staging_event"]);
  });

  it("refuses to copy from itself", async () => {
    await expect(
      importLiveData(
        { setup, ownOrigin: "https://mokupona.ch", includeSignups: true },
        deps(fakeSource({})),
      ),
    ).rejects.toThrow(/this site itself/);
  });

  it.each([
    [401, {}, /exactly the same on both sites/],
    [404, {}, /doesn't offer its data/],
    [500, {}, /HTTP 500/],
    [
      301,
      { location: "https://www.mokupona.ch/api/live-data" },
      /www\.mokupona\.ch/,
    ],
  ] as const)(
    "explains an HTTP %i from the live site",
    async (status, headers, message) => {
      const error = await importLiveData(
        { setup, ownOrigin: OWN_ORIGIN, includeSignups: true },
        deps(fakeSource(null, { status, headers })),
      ).catch((thrown: unknown) => thrown);

      expect(error).toBeInstanceOf(LiveDataImportError);
      expect((error as Error).message).toMatch(message);
    },
  );

  it("explains an answer in an unknown format", async () => {
    await expect(
      importLiveData(
        { setup, ownOrigin: OWN_ORIGIN, includeSignups: true },
        deps(fakeSource({ format: "something-else" })),
      ),
    ).rejects.toThrow(/same version of the app/);
  });

  it("explains an unreachable live site", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError("fetch failed");
    });

    await expect(
      importLiveData(
        { setup, ownOrigin: OWN_ORIGIN, includeSignups: true },
        deps(fetchImpl as unknown as ReturnType<typeof fakeSource>),
      ),
    ).rejects.toThrow(/Couldn't reach https:\/\/mokupona\.ch/);
  });
});

describe("checkLiveDataSource", () => {
  it("reports the live counts and how images would move", async () => {
    shareImages();
    const live = liveDataFixture("live");
    const body = await snapshotBody(live);
    delete (body as { data?: unknown }).data;
    const fetchImpl = fakeSource(body);

    const check = await checkLiveDataSource(
      setup,
      OWN_ORIGIN,
      fetchImpl as unknown as typeof fetch,
    );

    expect(fetchImpl.mock.calls[0][0]).toBe(
      "https://mokupona.ch/api/live-data?summary=1",
    );
    expect(check.summary.counts).toEqual(countLiveDataRows(live));
    expect(check.schemaProblem).toBeNull();
    expect(check.imageStrategy).toBe("share");
  });
});
