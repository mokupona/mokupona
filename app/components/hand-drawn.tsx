import { cn } from "~/lib/utils";

/**
 * A wobbling underline. Two offset strokes at different opacities read as
 * crayon dragged twice over the same line rather than a vector rule — the
 * site's one piece of deliberate imprecision.
 *
 * Colour comes from `currentColor`, so set it with a text utility.
 */
export function HandDrawnRule({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 400 14"
      fill="none"
      aria-hidden="true"
      className={cn("h-3", className)}
      preserveAspectRatio="none"
    >
      <path
        d="M4 8.5c38-3.2 77 1.4 115-1.1 41-2.7 82 2.9 123 .6 33-1.9 66 2.4 99-.4 12-1 20 .6 55 1.9"
        stroke="currentColor"
        strokeWidth="3.5"
        strokeLinecap="round"
        opacity="0.9"
      />
      <path
        d="M10 11c44 1.9 88-2.4 132-.5 47 2 94-1.7 141 .8 27 1.4 54-1.1 81 .4"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.45"
      />
    </svg>
  );
}
