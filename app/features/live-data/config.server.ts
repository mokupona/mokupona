import type { ImageProviderConfig } from "~/shared/image";

/** `openssl rand -hex 32` gives 64; anything under 32 is refused outright. */
export const LIVE_DATA_TOKEN_MIN_LENGTH = 32;

/**
 * What this instance plays in a live-data copy, decided by two variables:
 *
 * - `LIVE_DATA_TOKEN` alone: this is the live site. It answers authenticated
 *   export requests and never offers to overwrite itself.
 * - `LIVE_DATA_TOKEN` + `LIVE_DATA_SOURCE_URL`: this is a copy target
 *   (staging, a laptop). It can pull from the source and its own export is
 *   switched off, so a target can never be mistaken for the live site.
 * - neither: the feature is off.
 */
export type LiveDataSetup =
  | { mode: "off"; problem: string | null }
  | { mode: "source"; token: string }
  | { mode: "target"; token: string; sourceOrigin: string };

const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1", "[::1]"]);

function parseSourceOrigin(raw: string): string | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }

  // the token travels in a header: plain http only where it never leaves
  // the machine
  const secure =
    url.protocol === "https:" ||
    (url.protocol === "http:" && LOCAL_HOSTNAMES.has(url.hostname));
  if (!secure || url.username || url.password) return null;

  return url.origin;
}

export function readLiveDataSetup(
  env: NodeJS.ProcessEnv = process.env,
): LiveDataSetup {
  const token = env.LIVE_DATA_TOKEN?.trim() || null;
  const rawSource = env.LIVE_DATA_SOURCE_URL?.trim() || null;

  if (!token) {
    return {
      mode: "off",
      problem: rawSource
        ? "LIVE_DATA_SOURCE_URL is set, but LIVE_DATA_TOKEN is missing."
        : null,
    };
  }

  if (token.length < LIVE_DATA_TOKEN_MIN_LENGTH) {
    return {
      mode: "off",
      problem: `LIVE_DATA_TOKEN is too short — use at least ${LIVE_DATA_TOKEN_MIN_LENGTH} characters (openssl rand -hex 32).`,
    };
  }

  if (!rawSource) return { mode: "source", token };

  const sourceOrigin = parseSourceOrigin(rawSource);
  if (!sourceOrigin) {
    return {
      mode: "off",
      problem:
        "LIVE_DATA_SOURCE_URL must be an https:// address (http:// is only allowed for localhost).",
    };
  }

  return { mode: "target", token, sourceOrigin };
}

/** This instance's image provider, as the root loader also reports it. */
export function readImageProviderConfig(
  env: NodeJS.ProcessEnv = process.env,
): ImageProviderConfig {
  return {
    imageProvider: env.IMAGE_PROVIDER === "cloudinary" ? "cloudinary" : "local",
    cloudinaryCloudName: env.CLOUDINARY_CLOUD_NAME ?? null,
  };
}
