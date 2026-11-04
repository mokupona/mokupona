import { isRouteErrorResponse } from "react-router";

import { useText } from "~/features/site-text/site-text-context";

export function RouteErrorContent({ error }: { error: unknown }) {
  const t = useText();
  let heading = t("site.error.unknownHeading");
  let message: string | null = null;

  if (isRouteErrorResponse(error) && error.status === 404) {
    heading = t("site.error.notFoundHeading");
    message = t("site.error.notFoundMessage") || null;
  } else if (isRouteErrorResponse(error) && error.status === 403) {
    heading = t("site.error.forbiddenHeading");
    message = t("site.error.forbiddenMessage") || null;
  } else if (isRouteErrorResponse(error)) {
    heading = t("site.error.statusHeading", {
      status: error.status,
      statusText: error.statusText,
    });
    message = error.data;
  } else if (error instanceof Error) {
    heading = t("site.error.heading");
    message = error.message;
  }

  return (
    <div className="mx-auto mt-16 flex flex-col items-center gap-2 pt-4">
      <h1 className="font-semibold">{heading}</h1>
      {message != null ? <p>{message}</p> : null}
    </div>
  );
}
