import { cn } from "~/lib/utils";

/**
 * Html rendered from an admin's Markdown by `renderMarkdown`
 * (app/shared/markdown.server.ts), which escapes raw html and refuses unsafe
 * links, so it goes in as it is. Paragraphs, lists and links get spacing and
 * markers here; the type size and colour come from `className`.
 */
export function MarkdownText({
  html,
  className,
}: {
  html: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "space-y-4 [&_a]:underline [&_li+li]:mt-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_strong]:font-semibold [&_ul]:list-disc [&_ul]:pl-5",
        className,
      )}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
