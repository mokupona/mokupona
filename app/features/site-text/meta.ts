import { createText, type Text } from "./text";

import { getRootLoaderData } from "~/shared/root-data";

/** The site texts in a route's `meta`, which can't use hooks. */
export function textFromMatches(
  matches: readonly ({ id: string; loaderData: unknown } | undefined)[],
): Text {
  return createText(getRootLoaderData(matches)?.siteText);
}
