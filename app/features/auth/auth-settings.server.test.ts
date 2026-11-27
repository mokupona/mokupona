import { afterEach, describe, expect, it } from "vitest";

import {
  getAuthSettings,
  isAuthToggleEnabled,
  resetAuthSettings,
  setAuthToggleEnabled,
} from "./auth-settings.server";

import { prisma } from "~/db.server";

afterEach(async () => {
  await resetAuthSettings();
});

describe("auth settings store", () => {
  it("leaves every toggle open until something closes one", async () => {
    expect(await getAuthSettings()).toEqual({
      emailSignup: true,
      google: true,
    });
  });

  it("closes toggles independently of each other", async () => {
    await setAuthToggleEnabled("emailSignup", false);

    expect(await isAuthToggleEnabled("emailSignup")).toBe(false);
    expect(await isAuthToggleEnabled("google")).toBe(true);

    await setAuthToggleEnabled("google", false);
    await setAuthToggleEnabled("emailSignup", true);

    expect(await getAuthSettings()).toEqual({
      emailSignup: true,
      google: false,
    });
  });

  it("keeps what was set in the database, so a restart doesn't reopen it", async () => {
    await setAuthToggleEnabled("emailSignup", false);
    await setAuthToggleEnabled("google", false);

    // what a fresh process finds: nothing in memory, only the rows
    expect(
      await prisma.authSetting.findMany({
        select: { toggle: true, enabled: true },
        orderBy: { toggle: "asc" },
      }),
    ).toEqual([
      { toggle: "emailSignup", enabled: false },
      { toggle: "google", enabled: false },
    ]);
  });

  it("ignores a stored toggle the code no longer knows", async () => {
    await prisma.authSetting.create({
      data: { toggle: "retired", enabled: false },
    });

    expect(await getAuthSettings()).toEqual({
      emailSignup: true,
      google: true,
    });
  });

  it("opens every toggle again on reset", async () => {
    await setAuthToggleEnabled("emailSignup", false);

    expect(await resetAuthSettings()).toEqual({
      emailSignup: true,
      google: true,
    });
    expect(await prisma.authSetting.count()).toBe(0);
  });
});
