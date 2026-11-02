import type React from "react";
import { useEffect, useRef, useState } from "react";

import rowsData from "./rows.json";
import { rowOffset, wallRows } from "./scroll-offset";

import { cn } from "~/lib/utils";

const SPRITE_URL = "/sitelen/sprite.svg";
/**
 * px the glyph wall drifts up the screen per px of page scroll — less than 1,
 * so it moves with the page but lags behind it (parallax).
 */
const DRIFT = 0.35;
/** vertical gap between rows, px */
const ROW_GAP = 14;
/**
 * Rows cycle through rows.json's three word lists. Keeping the row count a
 * multiple of this lets a row recycled from the top to the bottom keep its
 * words.
 */
const ROW_PERIOD = rowsData.rows.length;
/** every this-many-th row slides sideways as the page scrolls; the rest hold still */
const SLIDE_EVERY = 3;
/** px of sideways travel per px of page scroll, for the sliding rows */
const SLIDE_SPEED = 0.55;
/** px each row is shifted sideways from the one above, so columns don't line up */
const ROW_STAGGER = 173;
/** copies of each row laid end to end, so a wide screen never sees the end */
const COPIES = 3;
/** smallest row pitch (mobile glyph + gap), used to work out how many rows fill the screen */
const MIN_ROW_PITCH = 72 + ROW_GAP;
/** the light paper patterns the sprite's symbols cycle through */
const LIGHT_PATTERNS = 4;
const TEXTURE_UNITS = 64;
/** how long a tapped glyph stays popped on touch screens */
const TAP_POP_MS = 650;

/**
 * A full-screen wallpaper of torn-paper toki pona glyphs (sitelen moku pona)
 * sitting behind the page. As the page scrolls the wall drifts up at a
 * fraction of the scroll speed (and back down on the way up), and every
 * third row also slides sideways, alternating left and right; rows leaving
 * the top are recycled to the bottom, so the wall never runs out. The
 * glyphs rest faint; the one under the pointer pops up and comes to full
 * strength. On touch screens a tap pops it.
 *
 * The layer never takes pointer events (the page above it stays fully
 * clickable), so the glyph under the pointer is found by hit-testing the
 * pointer position against the glyph boxes instead of relying on :hover.
 *
 * The glyph shapes arrive as one sprite after hydration — they are
 * decoration, so the layer fades in once they're ready.
 */
export function SitelenBackdrop({ className }: { className?: string }) {
  const sprite = useSprite();
  const rowCount = useRowCount();
  const rowRefs = useRef<(HTMLDivElement | null)[]>([]);
  const ready = sprite !== null && rowCount > 0;
  useScrollLinkedRows(rowRefs, ready, rowCount);
  usePointerPop(rowRefs, ready);

  return (
    <div
      aria-hidden="true"
      className={cn(
        "art-warm pointer-events-none fixed inset-0 -z-10 overflow-hidden select-none",
        className,
      )}
      style={
        {
          "--smp-rim": "rgb(246 240 252)",
          "--smp-shadow": "rgb(43 18 56 / 0.2)",
        } as React.CSSProperties
      }
    >
      <PaperPatterns />
      {sprite ? (
        // Kept in the DOM but out of sight: patterns and symbols inside a
        // display:none subtree don't render in every browser.
        <div
          className="absolute size-0 overflow-hidden"
          dangerouslySetInnerHTML={{ __html: sprite }}
        />
      ) : null}

      <div
        className={cn(
          "transition-opacity duration-700",
          ready ? "opacity-100" : "opacity-0",
        )}
      >
        {ready
          ? Array.from({ length: rowCount }, (_, row) => {
              const words = rowsData.rows[row % rowsData.rows.length] ?? [];
              return (
                <div
                  key={row}
                  ref={(el) => {
                    rowRefs.current[row] = el;
                  }}
                  className="absolute top-0 left-0 flex w-max will-change-transform data-active:z-10"
                >
                  {Array.from({ length: COPIES }, (_, copy) =>
                    words.map((word, i) => (
                      <Glyph
                        key={`${copy}-${word}`}
                        word={word}
                        index={i + row * 7}
                      />
                    )),
                  )}
                </div>
              );
            })
          : null}
      </div>
    </div>
  );
}

function Glyph({ word, index }: { word: string; index: number }) {
  // a little scrapbook unevenness: each glyph sits slightly off the line
  const nudge = ((index * 37) % 17) - 8;

  return (
    <span
      data-glyph
      className="group relative mx-1.5 block shrink-0 data-active:z-10 md:mx-2.5"
      style={{ transform: `translateY(${nudge}px)` }}
    >
      <svg
        viewBox="-8 -8 116 116"
        className="size-18 opacity-20 transition-[scale,opacity] duration-500 ease-[cubic-bezier(.3,1.6,.5,1)] group-data-active:scale-[1.6] group-data-active:opacity-100 motion-reduce:transition-none md:size-24"
      >
        <use href={`#smp-${word}`} />
      </svg>
    </span>
  );
}

/**
 * The paper textures, defined once for the whole page. The sprite's symbols
 * fill with url(#smp-paper-l0..3) and url(#smp-paper-d); the light pattern
 * comes in a few offsets so neighbouring glyphs don't show the same patch.
 */
function PaperPatterns() {
  const t = TEXTURE_UNITS;
  return (
    <svg className="absolute size-0" aria-hidden="true">
      <defs>
        {Array.from({ length: LIGHT_PATTERNS }, (_, i) => (
          <pattern
            key={i}
            id={`smp-paper-l${i}`}
            patternUnits="userSpaceOnUse"
            width={t}
            height={t}
            patternTransform={`translate(${(i * 23) % t} ${(i * 41) % t}) rotate(${i * 90})`}
          >
            <image href="/sitelen/paper-light.jpg" width={t} height={t} />
          </pattern>
        ))}
        <pattern
          id="smp-paper-d"
          patternUnits="userSpaceOnUse"
          width={t}
          height={t}
        >
          <image href="/sitelen/paper-dark.jpg" width={t} height={t} />
        </pattern>
      </defs>
    </svg>
  );
}

function useSprite() {
  const [sprite, setSprite] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    fetch(SPRITE_URL)
      .then((res) => (res.ok ? res.text() : null))
      .then((text) => {
        if (live && text) setSprite(text);
      })
      // decoration only: without the sprite the backdrop just stays empty
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);
  return sprite;
}

/**
 * Enough rows to cover the viewport top to bottom plus a spare at each end,
 * rounded up to a whole ROW_PERIOD.
 */
function useRowCount() {
  const [count, setCount] = useState(0);
  useEffect(() => {
    const measure = () => {
      const needed = Math.ceil(window.innerHeight / MIN_ROW_PITCH) + 2;
      setCount(Math.ceil(needed / ROW_PERIOD) * ROW_PERIOD);
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);
  return count;
}

function useScrollLinkedRows(
  rowRefs: React.RefObject<(HTMLDivElement | null)[]>,
  ready: boolean,
  rowCount: number,
) {
  useEffect(() => {
    if (!ready) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;

    const place = () => {
      frame = 0;
      const y = reduced.matches ? 0 : window.scrollY;
      const rows = rowRefs.current.slice(0, rowCount);
      const pitch = (rows[0]?.offsetHeight ?? 0) + ROW_GAP;
      if (!pitch) return;
      const { slot, top } = wallRows(y * DRIFT, pitch, rowCount);
      rows.forEach((row, i) => {
        if (!row) return;
        const k = slot(i);
        const copyWidth = row.scrollWidth / COPIES;
        // every SLIDE_EVERY-th row slides, alternating left and right; the
        // rest keep a fixed sideways stagger. Either way the offset wraps
        // within one copy, so the row's left end never shows.
        const sliding = mod(k, SLIDE_EVERY) === 0;
        const direction = mod(k / SLIDE_EVERY, 2) === 0 ? -1 : 1;
        const x = rowOffset(
          sliding ? y : 0,
          direction,
          copyWidth,
          SLIDE_SPEED,
          k * ROW_STAGGER,
        );
        row.style.transform = `translate3d(${x}px, ${top(k)}px, 0)`;
      });
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(place);
    };

    place();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    reduced.addEventListener("change", schedule);
    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      reduced.removeEventListener("change", schedule);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [ready, rowRefs, rowCount]);
}

/**
 * Marks the glyph under the pointer with data-active (and its row, so the
 * popped glyph rises above the neighbouring rows). Re-checked on scroll too,
 * since the rows slide under a resting mouse.
 */
function usePointerPop(
  rowRefs: React.RefObject<(HTMLDivElement | null)[]>,
  ready: boolean,
) {
  useEffect(() => {
    if (!ready) return;
    let frame = 0;
    let pointer: { x: number; y: number } | null = null;
    let active: HTMLElement | null = null;
    let tapTimer = 0;

    const glyphAt = (x: number, y: number) => {
      for (const row of rowRefs.current) {
        if (!row) continue;
        const r = row.getBoundingClientRect();
        // rows overlap a little (nudged glyphs), so check every row in range
        if (y < r.top - 12 || y > r.bottom + 12) continue;
        for (const glyph of row.children) {
          const g = glyph.getBoundingClientRect();
          if (x >= g.left && x < g.right && y >= g.top && y < g.bottom) {
            return glyph as HTMLElement;
          }
        }
      }
      return null;
    };

    const setActive = (glyph: HTMLElement | null) => {
      if (glyph === active) return;
      if (active) {
        delete active.dataset.active;
        delete active.parentElement?.dataset.active;
      }
      active = glyph;
      if (active) {
        active.dataset.active = "";
        if (active.parentElement) active.parentElement.dataset.active = "";
      }
    };

    const update = () => {
      frame = 0;
      setActive(pointer ? glyphAt(pointer.x, pointer.y) : null);
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };

    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      pointer = { x: e.clientX, y: e.clientY };
      schedule();
    };
    const onLeave = () => {
      pointer = null;
      schedule();
    };
    const onTap = (e: PointerEvent) => {
      if (e.pointerType === "mouse") return;
      window.clearTimeout(tapTimer);
      setActive(glyphAt(e.clientX, e.clientY));
      tapTimer = window.setTimeout(() => setActive(null), TAP_POP_MS);
    };
    const onScroll = () => {
      if (pointer) schedule();
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerdown", onTap, { passive: true });
    document.documentElement.addEventListener("pointerleave", onLeave);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerdown", onTap);
      document.documentElement.removeEventListener("pointerleave", onLeave);
      window.removeEventListener("scroll", onScroll);
      window.clearTimeout(tapTimer);
      if (frame) cancelAnimationFrame(frame);
      setActive(null);
    };
  }, [ready, rowRefs]);
}

function mod(n: number, m: number) {
  return m > 0 ? ((n % m) + m) % m : 0;
}
