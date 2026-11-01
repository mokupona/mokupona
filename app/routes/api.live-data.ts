import type { Route } from "./+types/api.live-data";

import { requestLoggerContext } from "~/features/auth/middleware.server";
import { readLiveDataSetup } from "~/features/live-data/config.server";
import {
  buildLiveDataSnapshot,
  buildLiveDataSummary,
  hasValidBearerToken,
} from "~/features/live-data/export.server";

const NO_STORE = { "Cache-Control": "no-store" };

/**
 * Machine-to-machine export of the live site's content, pulled by a copy
 * target's /admin/sync page. Answers 404 unless this instance is configured
 * as a source, and 401 without the shared bearer token.
 *
 * `?summary=1` returns row counts only; `?signups=0` leaves guests' signups
 * behind.
 */
export async function loader({ request, context }: Route.LoaderArgs) {
  const logger = context.get(requestLoggerContext);
  const setup = readLiveDataSetup();

  if (setup.mode !== "source") {
    throw new Response("Not found", { status: 404 });
  }

  if (!hasValidBearerToken(request, setup.token)) {
    logger.warn("Live data export refused: missing or wrong token");
    return new Response("Unauthorized", {
      status: 401,
      headers: { ...NO_STORE, "WWW-Authenticate": "Bearer" },
    });
  }

  const params = new URL(request.url).searchParams;

  if (params.get("summary") === "1") {
    return Response.json(await buildLiveDataSummary(), { headers: NO_STORE });
  }

  const includeSignups = params.get("signups") !== "0";
  const snapshot = await buildLiveDataSnapshot({ includeSignups });

  logger.warn(
    { includeSignups, counts: snapshot.counts },
    "Live data exported to a copy target",
  );

  return Response.json(snapshot, { headers: NO_STORE });
}
