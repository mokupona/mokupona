import { APIError, createAuthMiddleware } from "better-auth/api";

import { GOOGLE_DISABLED_ERROR } from "./auth-settings";
import { isAuthToggleEnabled } from "./auth-settings.server";

import { requestLogger } from "~/logger/request-context.server";
import { getClientIPAddress } from "~/shared/http.server";

const GOOGLE_PROVIDER_ID = "google";
const OAUTH_CALLBACK_PATH = "/callback/:id";
const SOCIAL_PROVIDER_PATHS = ["/sign-in/social", "/link-social"];

export function isGoogleProviderRequest(ctx: {
  path: string;
  body?: { provider?: unknown } | null;
  params?: unknown;
}): boolean {
  if (ctx.path === OAUTH_CALLBACK_PATH) {
    const params = ctx.params as { id?: unknown } | null | undefined;
    return params?.id === GOOGLE_PROVIDER_ID;
  }
  if (SOCIAL_PROVIDER_PATHS.includes(ctx.path)) {
    return ctx.body?.provider === GOOGLE_PROVIDER_ID;
  }
  return false;
}

export const googleGate = createAuthMiddleware(async (ctx) => {
  if (isAuthToggleEnabled(GOOGLE_PROVIDER_ID)) return;
  if (!isGoogleProviderRequest(ctx)) return;

  requestLogger.warn(
    {
      ip: ctx.request ? getClientIPAddress(ctx.request) : null,
      path: ctx.path,
    },
    "Blocked google request while google is disabled",
  );

  if (ctx.path === OAUTH_CALLBACK_PATH) {
    throw ctx.redirect(`/login?error=${GOOGLE_DISABLED_ERROR}`);
  }

  throw new APIError("FORBIDDEN", {
    code: "GOOGLE_DISABLED",
    // eslint-disable-next-line site-text/no-hardcoded-text -- API error body; visitors see auth.login.googleOffBody
    message: "Google sign-in is currently disabled",
  });
});
