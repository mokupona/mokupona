import type { ZodType } from "zod";

import { readImageProviderConfig, type LiveDataSetup } from "./config.server";
import {
  chooseImageStrategy,
  copyImages,
  imageFolders,
  withoutImages,
  type CopyImagesDeps,
  type ImageCopy,
  type ImageStrategy,
} from "./images.server";
import {
  countLiveDataRows,
  liveDataSnapshotSchema,
  liveDataSummarySchema,
  type LiveDataSnapshot,
  type LiveDataSummary,
} from "./snapshot";
import type { LiveDataCounts } from "./tables";

import {
  destroyImages,
  storeImage,
} from "~/features/images/image-storage.server";
import { getLocalImageFile } from "~/features/images/providers/local.server";
import { requestLogger } from "~/logger/request-context.server";
import {
  getImageCopiesByIds,
  listAppliedMigrations,
  replaceLiveDataTables,
} from "~/models/live-data.server";

type TargetSetup = Extract<LiveDataSetup, { mode: "target" }>;

/** A failure whose message is written for the admin who clicked the button. */
export class LiveDataImportError extends Error {
  override name = "LiveDataImportError";
}

const SUMMARY_TIMEOUT_MS = 15_000;
const SNAPSHOT_TIMEOUT_MS = 120_000;
const MAX_SNAPSHOT_BYTES = 200 * 1024 * 1024;

export const LIVE_DATA_EXPORT_PATH = "/api/live-data";

function describe(error: unknown) {
  if (error instanceof Error) {
    return error.name === "TimeoutError"
      ? "it took too long to answer"
      : error.message;
  }
  return String(error);
}

async function fetchFromSource<T>(
  setup: TargetSetup,
  query: string,
  schema: ZodType<T>,
  { timeoutMs, fetchImpl }: { timeoutMs: number; fetchImpl: typeof fetch },
): Promise<T> {
  const url = `${setup.sourceOrigin}${LIVE_DATA_EXPORT_PATH}?${query}`;

  let response: Response;
  try {
    response = await fetchImpl(url, {
      headers: {
        Authorization: `Bearer ${setup.token}`,
        Accept: "application/json",
      },
      // a redirect would either drop the token (cross-origin) or carry it
      // somewhere nobody configured — stop and say where it pointed instead
      redirect: "manual",
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    throw new LiveDataImportError(
      `Couldn't reach ${setup.sourceOrigin}: ${describe(error)}.`,
    );
  }

  if (response.status >= 300 && response.status < 400) {
    const location = response.headers.get("location");
    throw new LiveDataImportError(
      `${setup.sourceOrigin} redirected${location ? ` to ${location}` : ""}. Set LIVE_DATA_SOURCE_URL to the address the live site is actually served from.`,
    );
  }
  if (response.status === 404) {
    throw new LiveDataImportError(
      "The live site doesn't offer its data. It needs LIVE_DATA_TOKEN set (and no LIVE_DATA_SOURCE_URL) and has to run a version of the app with this feature.",
    );
  }
  if (response.status === 401) {
    throw new LiveDataImportError(
      "The live site turned the token down. LIVE_DATA_TOKEN has to be exactly the same on both sites.",
    );
  }
  if (!response.ok) {
    throw new LiveDataImportError(
      `The live site answered with HTTP ${response.status}.`,
    );
  }

  const declared = Number(response.headers.get("content-length") ?? 0);
  if (declared > MAX_SNAPSHOT_BYTES) {
    throw new LiveDataImportError("The live site's data is too large to copy.");
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch (error) {
    throw new LiveDataImportError(
      `The live site's answer couldn't be read: ${describe(error)}.`,
    );
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    requestLogger.warn(
      { issues: parsed.error.issues.slice(0, 10) },
      "Live data from the source did not match the expected format",
    );
    throw new LiveDataImportError(
      "The live site sent data in a format this version can't read. Deploy the same version of the app to both sites and try again.",
    );
  }

  return parsed.data;
}

/** Null when this site can take the source's data, otherwise why not. */
export function schemaProblem(
  sourceSchemaVersion: string | null,
  appliedMigrations: readonly string[],
): string | null {
  if (!sourceSchemaVersion || appliedMigrations.includes(sourceSchemaVersion)) {
    return null;
  }
  return `The live site's database is on migration ${sourceSchemaVersion}, which this site doesn't have yet. Deploy the latest code here first.`;
}

function assertNotSelf(setup: TargetSetup, ownOrigin: string) {
  if (new URL(ownOrigin).origin === setup.sourceOrigin) {
    throw new LiveDataImportError(
      "LIVE_DATA_SOURCE_URL points at this site itself.",
    );
  }
}

export interface LiveDataCheck {
  summary: LiveDataSummary;
  schemaProblem: string | null;
  imageStrategy: ImageStrategy;
}

/** Ask the source what it holds, without copying anything. */
export async function checkLiveDataSource(
  setup: TargetSetup,
  ownOrigin: string,
  fetchImpl: typeof fetch = fetch,
): Promise<LiveDataCheck> {
  assertNotSelf(setup, ownOrigin);

  const [summary, applied] = await Promise.all([
    fetchFromSource(setup, "summary=1", liveDataSummarySchema, {
      timeoutMs: SUMMARY_TIMEOUT_MS,
      fetchImpl,
    }),
    listAppliedMigrations(),
  ]);

  return {
    summary,
    schemaProblem: schemaProblem(summary.source.schemaVersion, applied),
    imageStrategy: chooseImageStrategy(
      summary.source,
      readImageProviderConfig(),
    ),
  };
}

export interface LiveDataImportResult {
  counts: LiveDataCounts;
  includesSignups: boolean;
  images: {
    strategy: ImageStrategy;
    copied: number;
    reused: number;
    failed: number;
  };
}

export interface ImportDeps {
  fetch: typeof fetch;
  store: CopyImagesDeps["store"];
  destroy: (storageKeys: string[]) => Promise<void>;
  copyStillPresent: CopyImagesDeps["copyStillPresent"];
}

function defaultDeps(): ImportDeps {
  const { imageProvider } = readImageProviderConfig();
  return {
    fetch,
    store: storeImage,
    destroy: destroyImages,
    copyStillPresent:
      imageProvider === "local"
        ? async (storageKey) => (await getLocalImageFile(storageKey)) !== null
        : async () => true,
  };
}

async function prepareImages(
  snapshot: LiveDataSnapshot,
  sourceOrigin: string,
  deps: ImportDeps,
) {
  const strategy = chooseImageStrategy(
    snapshot.source,
    readImageProviderConfig(),
  );
  if (strategy === "share") {
    return {
      strategy,
      tables: snapshot.data,
      storedKeys: [],
      stats: { copied: 0, reused: 0, failed: 0 },
    };
  }

  const previous = await getImageCopiesByIds(
    snapshot.data.images.map((image) => image.id),
  );
  const previousCopies = new Map<string, ImageCopy>(
    previous.map(({ id, ...copy }) => [id, copy]),
  );

  const result = await copyImages(
    {
      images: snapshot.data.images,
      folders: imageFolders(snapshot.data),
      source: snapshot.source,
      sourceOrigin,
    },
    { ...deps, previousCopies },
  );

  for (const { id, reason } of result.failed) {
    requestLogger.warn(
      { imageId: id, error: reason },
      "Live data image could not be copied; leaving it out",
    );
  }

  return {
    strategy,
    tables: withoutImages(
      { ...snapshot.data, images: result.images },
      new Set(result.failed.map(({ id }) => id)),
    ),
    storedKeys: result.storedKeys,
    stats: {
      copied: result.copied,
      reused: result.reused,
      failed: result.failed.length,
    },
  };
}

/**
 * Replace this site's events, locations, signup forms, signups, galleries and
 * board with the live site's. Users and logins stay as they are. Either the
 * whole copy lands or nothing in the database changes.
 */
export async function importLiveData(
  {
    setup,
    ownOrigin,
    includeSignups,
  }: { setup: TargetSetup; ownOrigin: string; includeSignups: boolean },
  deps: ImportDeps = defaultDeps(),
): Promise<LiveDataImportResult> {
  assertNotSelf(setup, ownOrigin);

  const snapshot = await fetchFromSource(
    setup,
    `signups=${includeSignups ? "1" : "0"}`,
    liveDataSnapshotSchema,
    { timeoutMs: SNAPSHOT_TIMEOUT_MS, fetchImpl: deps.fetch },
  );

  const problem = schemaProblem(
    snapshot.source.schemaVersion,
    await listAppliedMigrations(),
  );
  if (problem) throw new LiveDataImportError(problem);

  const { strategy, tables, storedKeys, stats } = await prepareImages(
    snapshot,
    setup.sourceOrigin,
    deps,
  );

  let previousStorageKeys: string[];
  try {
    ({ previousStorageKeys } = await replaceLiveDataTables(tables));
  } catch (error) {
    // the database is untouched, so this run's fresh copies are orphans
    await deps.destroy(storedKeys);
    throw error;
  }

  // what this site showed before and no longer references. The Cloudinary
  // provider refuses to destroy anything outside this site's own folder, so a
  // previously shared live-site asset is safe here even if it slipped in.
  const kept = new Set(tables.images.map((image) => image.storageKey));
  await deps.destroy(previousStorageKeys.filter((key) => !kept.has(key)));

  return {
    counts: countLiveDataRows(tables),
    includesSignups: snapshot.includesSignups,
    images: { strategy, ...stats },
  };
}
