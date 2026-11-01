// @vitest-environment node

import { describe, expect, it } from "vitest";

import { readLiveDataSetup } from "./config.server";

const TOKEN = "a".repeat(64);

function env(values: Record<string, string>) {
  return values as NodeJS.ProcessEnv;
}

describe("readLiveDataSetup", () => {
  it("is off without a token", () => {
    expect(readLiveDataSetup(env({}))).toEqual({ mode: "off", problem: null });
  });

  it("is the live site with a token alone", () => {
    expect(readLiveDataSetup(env({ LIVE_DATA_TOKEN: TOKEN }))).toEqual({
      mode: "source",
      token: TOKEN,
    });
  });

  it("is a copy target with a token and a source, reduced to its origin", () => {
    expect(
      readLiveDataSetup(
        env({
          LIVE_DATA_TOKEN: TOKEN,
          LIVE_DATA_SOURCE_URL: "https://mokupona.ch/some/path?x=1",
        }),
      ),
    ).toEqual({
      mode: "target",
      token: TOKEN,
      sourceOrigin: "https://mokupona.ch",
    });
  });

  it("explains a source without a token", () => {
    const setup = readLiveDataSetup(
      env({ LIVE_DATA_SOURCE_URL: "https://mokupona.ch" }),
    );
    expect(setup.mode).toBe("off");
    expect(setup).toHaveProperty("problem", expect.stringMatching(/TOKEN/));
  });

  it("refuses a short token, even on the live site", () => {
    const setup = readLiveDataSetup(env({ LIVE_DATA_TOKEN: "short" }));
    expect(setup.mode).toBe("off");
    expect(setup).toHaveProperty("problem", expect.stringMatching(/too short/));
  });

  it.each([
    "http://mokupona.ch",
    "ftp://mokupona.ch",
    "https://user:pass@mokupona.ch",
    "not a url",
  ])("refuses %s as a source", (source) => {
    const setup = readLiveDataSetup(
      env({ LIVE_DATA_TOKEN: TOKEN, LIVE_DATA_SOURCE_URL: source }),
    );
    expect(setup.mode).toBe("off");
    expect(setup).toHaveProperty("problem", expect.stringMatching(/https/));
  });

  it("allows plain http to localhost", () => {
    expect(
      readLiveDataSetup(
        env({
          LIVE_DATA_TOKEN: TOKEN,
          LIVE_DATA_SOURCE_URL: "http://localhost:8811",
        }),
      ),
    ).toMatchObject({ mode: "target", sourceOrigin: "http://localhost:8811" });
  });
});
