// @vitest-environment node

import { RouterContextProvider } from "react-router";
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import {
  EMPTY_LIVE_DATA,
  liveDataFixture,
} from "../../../test/live-data-fixture";

import { hasValidBearerToken, tokensMatch } from "./export.server";
import { liveDataSnapshotSchema, liveDataSummarySchema } from "./snapshot";

import { replaceLiveDataTables } from "~/models/live-data.server";
import { loader } from "~/routes/api.live-data";

const TOKEN = "s".repeat(64);

async function get(
  query = "",
  authorization: string | null = `Bearer ${TOKEN}`,
) {
  const response = await loader({
    request: new Request(`http://localhost:3000/api/live-data${query}`, {
      headers: authorization ? { authorization } : {},
    }),
    params: {},
    context: new RouterContextProvider(),
  } as unknown as Parameters<typeof loader>[0]).catch(
    (thrown: unknown) => thrown,
  );
  return response as Response;
}

beforeAll(async () => {
  await replaceLiveDataTables(liveDataFixture("export"));
});

afterAll(async () => {
  await replaceLiveDataTables(EMPTY_LIVE_DATA);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("tokensMatch", () => {
  it("compares whole tokens of any length", () => {
    expect(tokensMatch(TOKEN, TOKEN)).toBe(true);
    expect(tokensMatch(`${TOKEN}x`, TOKEN)).toBe(false);
    expect(tokensMatch("", TOKEN)).toBe(false);
  });
});

describe("hasValidBearerToken", () => {
  function request(authorization?: string) {
    return new Request("http://localhost/", {
      headers: authorization ? { authorization } : {},
    });
  }

  it("accepts the token as a bearer credential", () => {
    expect(hasValidBearerToken(request(`Bearer ${TOKEN}`), TOKEN)).toBe(true);
    expect(hasValidBearerToken(request(`bearer ${TOKEN}`), TOKEN)).toBe(true);
  });

  it("rejects anything else", () => {
    expect(hasValidBearerToken(request(), TOKEN)).toBe(false);
    expect(hasValidBearerToken(request(TOKEN), TOKEN)).toBe(false);
    expect(hasValidBearerToken(request(`Basic ${TOKEN}`), TOKEN)).toBe(false);
    expect(hasValidBearerToken(request("Bearer wrong"), TOKEN)).toBe(false);
  });
});

describe("GET /api/live-data", () => {
  it("does not exist while the export is not configured", async () => {
    const response = await get();
    expect(response.status).toBe(404);
  });

  it("does not exist on a copy target, even with the right token", async () => {
    vi.stubEnv("LIVE_DATA_TOKEN", TOKEN);
    vi.stubEnv("LIVE_DATA_SOURCE_URL", "https://mokupona.ch");

    const response = await get();
    expect(response.status).toBe(404);
  });

  it("turns away a missing or wrong token", async () => {
    vi.stubEnv("LIVE_DATA_TOKEN", TOKEN);

    expect((await get("", null)).status).toBe(401);
    const wrong = await get("", `Bearer ${"x".repeat(64)}`);
    expect(wrong.status).toBe(401);
    expect(wrong.headers.get("WWW-Authenticate")).toBe("Bearer");
  });

  it("serves counts only for a summary", async () => {
    vi.stubEnv("LIVE_DATA_TOKEN", TOKEN);

    const response = await get("?summary=1");
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");

    const body = await response.json();
    expect(body).not.toHaveProperty("data");
    const summary = liveDataSummarySchema.parse(body);
    expect(summary.counts.events).toBe(1);
    expect(summary.source.schemaVersion).toMatch(/^\d{14}_/);
  });

  it("serves a snapshot the import side can read", async () => {
    vi.stubEnv("LIVE_DATA_TOKEN", TOKEN);
    vi.stubEnv("IMAGE_PROVIDER", "cloudinary");
    vi.stubEnv("CLOUDINARY_CLOUD_NAME", "mokupona");

    const response = await get();
    const snapshot = liveDataSnapshotSchema.parse(await response.json());

    expect(snapshot.data).toEqual(liveDataFixture("export"));
    expect(snapshot.includesSignups).toBe(true);
    expect(snapshot.source).toMatchObject({
      imageProvider: "cloudinary",
      cloudinaryCloudName: "mokupona",
    });
  });

  it("leaves signups behind with signups=0", async () => {
    vi.stubEnv("LIVE_DATA_TOKEN", TOKEN);

    const response = await get("?signups=0");
    const snapshot = liveDataSnapshotSchema.parse(await response.json());

    expect(snapshot.includesSignups).toBe(false);
    expect(snapshot.data.formSubmissions).toEqual([]);
    expect(snapshot.data.eventResponses).toEqual([]);
    expect(snapshot.counts.formSubmissions).toBe(0);
  });

  it("never carries accounts, sessions or password hashes", async () => {
    vi.stubEnv("LIVE_DATA_TOKEN", TOKEN);

    const body = await (await get()).text();

    for (const field of [
      "password",
      "accessToken",
      "refreshToken",
      "tokenHash",
      "roleId",
    ]) {
      expect(body).not.toContain(field);
    }
  });
});
