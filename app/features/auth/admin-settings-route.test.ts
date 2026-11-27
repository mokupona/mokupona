// @vitest-environment node
import { RouterContextProvider } from "react-router";
import { afterEach, describe, expect, it } from "vitest";

import { resetAuthSettings } from "./auth-settings.server";

import { prisma } from "~/db.server";
import { action, loader } from "~/routes/admin.settings";

afterEach(async () => {
  await resetAuthSettings();
});

function switchToggle(toggle: string, enabled: boolean) {
  return action({
    params: {},
    request: new Request("http://localhost:3000/admin/settings", {
      method: "POST",
      body: new URLSearchParams({ toggle, enabled: String(enabled) }),
    }),
    context: new RouterContextProvider(),
  } as unknown as Parameters<typeof action>[0]);
}

function load() {
  return loader({} as Parameters<typeof loader>[0]);
}

describe("admin settings", () => {
  it("keeps a switched-off toggle in the database, where a restart finds it", async () => {
    await switchToggle("google", false);
    await switchToggle("emailSignup", false);

    expect(await load()).toEqual({
      authSettings: { emailSignup: false, google: false },
    });
    expect(
      await prisma.authSetting.findUnique({ where: { toggle: "google" } }),
    ).toMatchObject({ enabled: false });
  });

  it("switches a toggle back on", async () => {
    await switchToggle("emailSignup", false);
    await switchToggle("emailSignup", true);

    expect((await load()).authSettings.emailSignup).toBe(true);
  });

  it("refuses a toggle it doesn't know", async () => {
    await expect(switchToggle("magicLink", false)).rejects.toMatchObject({
      status: 400,
    });
    expect(await prisma.authSetting.count()).toBe(0);
  });
});
