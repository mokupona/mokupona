import { cn } from "~/lib/utils";

/**
 * The hand-drawn section headings, with the intrinsic size of each file so
 * the browser can reserve space before it loads. `alt` carries the words the
 * artwork spells, which is what a screen reader announces in place of it.
 * `?v=` busts the hour-long cache on public/ files: bump it whenever the
 * artwork changes (same for the logo and the wordmark).
 */
export const handwrittenHeadings = {
  ourVision: {
    src: "/our_vision.svg?v=alpha",
    alt: "our vision",
    width: 1064,
    height: 273,
  },
  nextDinner: {
    src: "/next_dinner.svg?v=alpha",
    alt: "the next dinner",
    width: 1043,
    height: 325,
  },
  pastDinners: {
    src: "/past_dinners.svg?v=alpha",
    alt: "past dinners",
    width: 1074,
    height: 351,
  },
} as const;

export type HandwrittenHeadingName = keyof typeof handwrittenHeadings;

export function HandwrittenHeading({
  name,
  className,
}: {
  name: HandwrittenHeadingName;
  className?: string;
}) {
  const { src, alt, width, height } = handwrittenHeadings[name];

  return (
    <img
      src={src}
      alt={alt}
      width={width}
      height={height}
      loading="lazy"
      // Like the wordmark, the ground is transparent
      // (scripts/artwork/transparent.py), so these sit on any background.
      //
      // self-start matters: in a flex column the default stretch would blow
      // `w-auto` out to the full column and squash the writing, and because
      // the artwork's empty margins stretch with it the result reads as a
      // centred heading rather than a broken one.
      className={cn(
        "art-warm h-9 w-auto self-start object-contain md:h-11",
        className,
      )}
    />
  );
}
