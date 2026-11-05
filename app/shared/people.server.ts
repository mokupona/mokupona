import type { Person } from "~/components/person-card";
import type { ImageMetadata } from "~/models/image.server";
import { renderOptionalMarkdown } from "~/shared/markdown.server";

/**
 * A board member or volunteer as the people grid shows them. The bio is the
 * admin's Markdown, rendered here so the page gets safe html.
 */
export function toPerson(
  {
    id,
    name,
    bio,
    image,
  }: {
    id: string;
    name: string;
    bio: string | null;
    image: ImageMetadata | null;
  },
  subtitle: string | null,
): Person {
  return { id, name, subtitle, bioHtml: renderOptionalMarkdown(bio), image };
}
