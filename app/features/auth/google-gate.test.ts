// @vitest-environment node
// (happy-dom swaps the fetch primitives; better-auth needs the real ones)

import { afterEach, describe, expect, it } from "vitest";

import {
  resetAuthSettings,
  setAuthToggleEnabled,
} from "./auth-settings.server";
import { googleGate, isGoogleProviderRequest } from "./google-gate.server";

afterEach(async () => {
  await resetAuthSettings();
});

// What better-auth hands a `hooks.before` middleware: the route pattern as
// `path`, the parsed body, and the matched route params.
function hookContext({
  path,
  provider,
  id,
}: {
  path: string;
  provider?: string;
  id?: string;
}) {
  return {
    path,
    method: path === "/callback/:id" ? "GET" : "POST",
    body: provider ? { provider } : undefined,
    params: id ? { id } : {},
    headers: new Headers(),
  };
}

async function run(context: ReturnType<typeof hookContext>) {
  return googleGate(context as unknown as Parameters<typeof googleGate>[0]);
}

async function refusal(context: ReturnType<typeof hookContext>) {
  return run(context).then(
    () => null,
    (error: unknown) => error as { status: string; body?: { code?: string } },
  );
}

describe("google provider predicate", () => {
  it("spots the endpoints that speak for the google provider", () => {
    expect(
      isGoogleProviderRequest(
        hookContext({ path: "/sign-in/social", provider: "google" }),
      ),
    ).toBe(true);
    expect(
      isGoogleProviderRequest(
        hookContext({ path: "/link-social", provider: "google" }),
      ),
    ).toBe(true);
    expect(
      isGoogleProviderRequest(
        hookContext({ path: "/callback/:id", id: "google" }),
      ),
    ).toBe(true);
  });

  it("leaves another provider and unrelated endpoints alone", () => {
    expect(
      isGoogleProviderRequest(
        hookContext({ path: "/sign-in/social", provider: "github" }),
      ),
    ).toBe(false);
    expect(
      isGoogleProviderRequest(
        hookContext({ path: "/callback/:id", id: "github" }),
      ),
    ).toBe(false);
    expect(
      isGoogleProviderRequest(hookContext({ path: "/sign-in/email" })),
    ).toBe(false);
  });
});

describe("google gate", () => {
  it("passes everything through while google is enabled", async () => {
    await expect(
      run(hookContext({ path: "/sign-in/social", provider: "google" })),
    ).resolves.toBeUndefined();
    await expect(
      run(hookContext({ path: "/callback/:id", id: "google" })),
    ).resolves.toBeUndefined();
  });

  it("refuses a google sign-in with a 403 once google is disabled", async () => {
    await setAuthToggleEnabled("google", false);

    const error = await refusal(
      hookContext({ path: "/sign-in/social", provider: "google" }),
    );

    expect(error?.status).toBe("FORBIDDEN");
    expect(error?.body?.code).toBe("GOOGLE_DISABLED");
  });

  it("refuses account linking the same way", async () => {
    await setAuthToggleEnabled("google", false);

    const error = await refusal(
      hookContext({ path: "/link-social", provider: "google" }),
    );

    expect(error?.status).toBe("FORBIDDEN");
    expect(error?.body?.code).toBe("GOOGLE_DISABLED");
  });

  it("sends the oauth callback back to login instead of a json error", async () => {
    await setAuthToggleEnabled("google", false);

    const error = (await refusal(
      hookContext({ path: "/callback/:id", id: "google" }),
    )) as { status: string; headers?: Headers } | null;

    expect(error?.status).toBe("FOUND");
    expect(error?.headers?.get("location")).toBe(
      "/login?error=google_disabled",
    );
  });

  it("leaves a non-google provider alone while google is disabled", async () => {
    await setAuthToggleEnabled("google", false);

    await expect(
      run(hookContext({ path: "/sign-in/social", provider: "github" })),
    ).resolves.toBeUndefined();
    await expect(
      run(hookContext({ path: "/callback/:id", id: "github" })),
    ).resolves.toBeUndefined();
  });

  it("leaves unrelated endpoints alone while google is disabled", async () => {
    await setAuthToggleEnabled("google", false);

    for (const path of ["/sign-in/email", "/sign-up/email", "/get-session"]) {
      await expect(run(hookContext({ path }))).resolves.toBeUndefined();
    }
  });
});
