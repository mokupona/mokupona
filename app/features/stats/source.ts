/**
 * Links the team hands out can say where they were shared: `?src=qr` on the
 * event QR codes, or any `?src=…` they put on a link themselves (an
 * Instagram bio, a newsletter). The statistics count the visit under that
 * name, and the tracker takes the parameter back off the address bar so a
 * link copied from there doesn't carry it on.
 */
export const SOURCE_PARAM = "src";

/** The source the event QR codes carry. */
export const QR_SOURCE = "qr";

/** `url` with its visits attributed to `source`. */
export function withSource(url: string, source: string) {
  const tagged = new URL(url);
  tagged.searchParams.set(SOURCE_PARAM, source);
  return tagged.href;
}
