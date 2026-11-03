import type React from "react";
import { useEffect, useRef } from "react";

import type { TitleCardBlockType } from "./model";

import { HandDrawnRule } from "~/components/hand-drawn";
import { useText } from "~/features/site-text/site-text-context";
import { cn } from "~/lib/utils";

/** px of scroll over which the scroll cue fades out */
const CUE_FADE_DISTANCE = 120;

type TitleCardBlockViewProps = React.ComponentPropsWithoutRef<"section"> & {
  blockData: TitleCardBlockType;
};

/**
 * The title card: the club's name, a great deal of quiet, and a cue to scroll.
 * Deliberately holds nothing else — the dinners live below the fold.
 */
export function TitleCardBlockView({
  blockData,
  className,
  ...rest
}: TitleCardBlockViewProps) {
  const { title, logo, tagline, scrollTo } = blockData.data;

  return (
    <section
      className={cn(
        // Sits just under the sticky nav, so subtract its height rather than
        // using a bare 100svh, which would push the cue off-screen on mobile.
        "flex min-h-[calc(100svh-4rem)] flex-col items-center justify-center px-5 py-16",
        className,
      )}
      {...rest}
    >
      <div className="flex flex-col items-center gap-6">
        {logo ? (
          <img
            src={logo.src}
            width={logo.width}
            height={logo.height}
            alt={title}
            // Brand artwork, above the fold — never lazy-load it.
            loading="eager"
            decoding="sync"
            // transparent ground (scripts/artwork/transparent.py), so the
            // glyph backdrop shows through around the letters
            className="art-warm h-auto w-[min(80vw,34rem)]"
          />
        ) : (
          <h1 className="text-center text-6xl leading-none font-light tracking-tight sm:text-7xl md:text-8xl">
            {title}
          </h1>
        )}

        <HandDrawnRule className="text-crayon/45 w-[min(70vw,26rem)]" />

        {tagline ? (
          <p className="text-muted-foreground max-w-md text-center text-sm font-light tracking-wide md:text-base">
            {tagline}
          </p>
        ) : null}
      </div>

      {scrollTo ? <ScrollCue href={scrollTo} /> : null}
    </section>
  );
}

/**
 * "scroll ↓". Its job is done once the page moves, so it fades out with the
 * scroll (and back in on the way up); fully gone it stops taking clicks.
 */
function ScrollCue({ href }: { href: string }) {
  const t = useText();
  const ref = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    const cue = ref.current;
    if (!cue) return;
    let frame = 0;
    const place = () => {
      frame = 0;
      const opacity = Math.max(0, 1 - window.scrollY / CUE_FADE_DISTANCE);
      cue.style.opacity = String(opacity);
      cue.style.pointerEvents = opacity === 0 ? "none" : "";
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(place);
    };
    place();
    window.addEventListener("scroll", schedule, { passive: true });
    return () => {
      window.removeEventListener("scroll", schedule);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <a
      ref={ref}
      href={href}
      className="text-muted-foreground hover:text-foreground focus-visible:ring-ring mt-20 flex flex-col items-center gap-2 rounded-md px-3 py-2 text-xs tracking-[0.2em] uppercase transition-colors focus-visible:ring-2 focus-visible:outline-hidden md:mt-28"
    >
      <span>{t("landing.titleCard.scroll")}</span>
      <svg
        viewBox="0 0 24 30"
        fill="none"
        aria-hidden="true"
        className="h-6 w-5 motion-safe:animate-bounce"
      >
        <path
          d="M12 3c-.6 7 .8 14-.4 22"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        <path
          d="M5 18c3.2 3.1 5.2 6.4 7 8.7 2-2.6 3.9-5.6 7-8.4"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </a>
  );
}
