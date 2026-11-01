// @vitest-environment node

import type { SubmissionResult } from "@conform-to/react";
import { RouterContextProvider } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type * as ImportServer from "./import.server";

import { userContext } from "~/features/auth/middleware.server";
import { action, loader } from "~/routes/admin.sync";

const TOKEN = "z".repeat(64);

const mocks = vi.hoisted(() => ({
  importLiveData: vi.fn(),
  checkLiveDataSource: vi.fn(),
}));

vi.mock("./import.server", async (importOriginal) => {
  const original = await importOriginal<typeof ImportServer>();
  return {
    ...original,
    importLiveData: mocks.importLiveData,
    checkLiveDataSource: mocks.checkLiveDataSource,
  };
});

function context() {
  const provider = new RouterContextProvider();
  provider.set(userContext, {
    id: "admin-id",
  } as unknown as Parameters<typeof provider.set<typeof userContext>>[1]);
  return provider;
}

function load(query = "") {
  return loader({
    request: new Request(`https://staging.mokupona.ch/admin/sync${query}`),
    params: {},
    context: context(),
  } as unknown as Parameters<typeof loader>[0]);
}

function submit(fields: Record<string, string> = {}) {
  const body = new FormData();
  for (const [key, value] of Object.entries(fields)) body.append(key, value);
  return action({
    request: new Request("https://staging.mokupona.ch/admin/sync", {
      method: "POST",
      body,
    }),
    params: {},
    context: context(),
  } as unknown as Parameters<typeof action>[0]).catch(
    (thrown: unknown) => thrown,
  );
}

function configureTarget() {
  vi.stubEnv("LIVE_DATA_TOKEN", TOKEN);
  vi.stubEnv("LIVE_DATA_SOURCE_URL", "https://mokupona.ch");
}

beforeEach(() => {
  mocks.importLiveData.mockReset();
  mocks.checkLiveDataSource.mockReset();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("admin sync loader", () => {
  it("tells the page its role without ever handing it the token", async () => {
    configureTarget();

    const data = await load();

    expect(data.status).toEqual({
      mode: "target",
      sourceOrigin: "https://mokupona.ch",
      problem: null,
    });
    expect(JSON.stringify(data)).not.toContain(TOKEN);
    expect(mocks.checkLiveDataSource).not.toHaveBeenCalled();
  });

  it("checks the live site on request and reports failures as text", async () => {
    configureTarget();
    const { LiveDataImportError } =
      await vi.importActual<typeof ImportServer>("./import.server");
    mocks.checkLiveDataSource.mockRejectedValue(
      new LiveDataImportError("The live site turned the token down."),
    );

    const data = await load("?check=1");

    expect(data.check).toEqual({
      ok: false,
      message: "The live site turned the token down.",
    });
  });

  it("never checks from the live site itself", async () => {
    vi.stubEnv("LIVE_DATA_TOKEN", TOKEN);

    const data = await load("?check=1");

    expect(data.status.mode).toBe("source");
    expect(data.check).toBeNull();
  });
});

describe("admin sync action", () => {
  it("does not exist unless this site is a copy target", async () => {
    vi.stubEnv("LIVE_DATA_TOKEN", TOKEN);

    const response = (await submit()) as Response;

    expect(response.status).toBe(404);
    expect(mocks.importLiveData).not.toHaveBeenCalled();
  });

  it("copies and redirects back with a toast", async () => {
    configureTarget();
    mocks.importLiveData.mockResolvedValue({
      counts: {
        addresses: 2,
        images: 5,
        forms: 3,
        formVersions: 3,
        formSubmissions: 7,
        events: 3,
        eventResponses: 1,
        eventGalleryImages: 4,
        boardMembers: 2,
      },
      includesSignups: true,
      images: { strategy: "share", copied: 0, reused: 0, failed: 0 },
    });

    const response = (await submit({ includeSignups: "on" })) as Response;

    expect(mocks.importLiveData).toHaveBeenCalledWith({
      setup: expect.objectContaining({ mode: "target" }),
      ownOrigin: "https://staging.mokupona.ch",
      includeSignups: true,
    });
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("/admin/sync");
    expect(response.headers.get("set-cookie")).toContain("__toast");
  });

  it("leaves signups behind when the box is unticked", async () => {
    configureTarget();
    mocks.importLiveData.mockResolvedValue({
      counts: {},
      includesSignups: false,
      images: { strategy: "share", copied: 0, reused: 0, failed: 0 },
    });

    await submit();

    expect(mocks.importLiveData).toHaveBeenCalledWith(
      expect.objectContaining({ includeSignups: false }),
    );
  });

  it("shows a refused copy as a form error", async () => {
    configureTarget();
    const { LiveDataImportError } =
      await vi.importActual<typeof ImportServer>("./import.server");
    mocks.importLiveData.mockRejectedValue(
      new LiveDataImportError("Deploy the latest code here first."),
    );

    const result = (await submit()) as SubmissionResult;

    expect(result.error?.[""]).toEqual(["Deploy the latest code here first."]);
  });
});
