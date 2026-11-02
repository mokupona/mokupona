import { createHash, timingSafeEqual } from "node:crypto";

import { readImageProviderConfig } from "./config.server";
import {
  countLiveDataRows,
  LIVE_DATA_FORMAT,
  LIVE_DATA_FORMAT_VERSION,
  type LiveDataSnapshot,
  type LiveDataSource,
  type LiveDataSummary,
} from "./snapshot";

import {
  countLiveDataTables,
  listAppliedMigrations,
  readLiveDataTables,
} from "~/models/live-data.server";

function digest(value: string) {
  return createHash("sha256").update(value, "utf8").digest();
}

/** Constant-time on equal-length digests, whatever the inputs' lengths. */
export function tokensMatch(presented: string, expected: string): boolean {
  return timingSafeEqual(digest(presented), digest(expected));
}

export function hasValidBearerToken(
  request: Request,
  expected: string,
): boolean {
  const header = request.headers.get("authorization");
  const match = header ? /^Bearer\s+(\S+)\s*$/i.exec(header) : null;
  return match ? tokensMatch(match[1], expected) : false;
}

async function describeSource(): Promise<LiveDataSource> {
  const migrations = await listAppliedMigrations();
  const { imageProvider, cloudinaryCloudName } = readImageProviderConfig();

  return {
    schemaVersion: migrations.at(-1) ?? null,
    imageProvider,
    cloudinaryCloudName,
  };
}

/** Row counts only — what the admin page shows before anything is copied. */
export async function buildLiveDataSummary(): Promise<LiveDataSummary> {
  const [source, counts] = await Promise.all([
    describeSource(),
    countLiveDataTables(),
  ]);

  return {
    format: LIVE_DATA_FORMAT,
    formatVersion: LIVE_DATA_FORMAT_VERSION,
    exportedAt: new Date(),
    includesSignups: true,
    source,
    counts,
  };
}

export async function buildLiveDataSnapshot({
  includeSignups,
}: {
  includeSignups: boolean;
}): Promise<LiveDataSnapshot> {
  const [source, data] = await Promise.all([
    describeSource(),
    readLiveDataTables({ includeSignups }),
  ]);

  return {
    format: LIVE_DATA_FORMAT,
    formatVersion: LIVE_DATA_FORMAT_VERSION,
    exportedAt: new Date(),
    includesSignups: includeSignups,
    source,
    counts: countLiveDataRows(data),
    data,
  };
}
