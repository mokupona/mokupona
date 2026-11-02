import type React from "react";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";

import rowsData from "./rows.json";
import { rowOffset, wallRows } from "./scroll-offset";
import { shuffledRows } from "./shuffle";

import { cn } from "~/lib/utils";

const SPRITE_URL = "/sitelen/sprite.svg";
/**
 * px the glyph wall drifts up the screen per px of page scroll — less than 1,
 * so it moves with the page but lags behind it (parallax).
 */
const DRIFT = 0.35;
/** vertical gap between rows, px */
const ROW_GAP = 14;
/** glyphs per row (before the row is repeated COPIES times) */
const ROW_LENGTH = 20;
/**
 * Every this-many-th row slides sideways as the page scrolls, alternating
 * left and right; the rest hold still. 0 turns sliding off (current setting).
 * Tried and liked enough to keep around: 3 or 7.
 */
const SLIDE_EVERY: number = 0;
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
/** clicking one of these glyphs opens the arcade easter egg */
const EASTER_EGG_WORDS = new Set(["moku", "pona"]);
export const EASTER_EGG_PATH = "/musi";
/** a click on any of these is the page's own, never the backdrop's */
const INTERACTIVE =
  "a, button, input, select, textarea, label, summary, [role=button], [contenteditable]";

/**
 * A full-screen wallpaper of torn-paper toki pona glyphs (sitelen moku pona)
 * sitting behind the page. As the page scrolls the wall drifts up at a
 * fraction of the scroll speed (and back down on the way up) — optionally
 * with some rows sliding sideways too, see SLIDE_EVERY; rows leaving
 * the top are recycled to the bottom, so the wall never runs out. The
 * glyphs rest faint; the one under the pointer pops up and comes to full
 * strength. That's a mouse-only touch: on phones the glyphs just sit there.
 * moku and pona are doors: a click or tap on either (where the page itself
 * has nothing clickable) opens /musi.
 *
 * The layer never takes pointer events (the page above it stays fully
 * clickable), so the glyph under the pointer is found by hit-testing the
 * pointer position against the glyph boxes instead of relying on :hover.
 *
 * The glyph shapes arrive as one sprite after hydration — they are
 * decoration, so the layer fades in once they're ready.
 */
export function SitelenBackdrop({ className }: { className?: string }) {
  const sprite = useSprite(SPRITE_URL);
  const rowCount = useRowCount();
  const rows = useShuffledRows(rowCount);
  const rowRefs = useRef<(HTMLDivElement | null)[]>([]);
  const ready = sprite !== null && rowCount > 0 && rows.length >= rowCount;
  useScrollLinkedRows(rowRefs, ready, rowCount);
  usePointerPop(rowRefs, ready);

  return (
    <div
      aria-hidden="true"
      className={cn(
        "art-warm pointer-events-none fixed inset-0 overflow-hidden select-none",
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
              const words = rows[row] ?? [];
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
      data-word={word}
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
export function PaperPatterns() {
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

export function useSprite(url: string) {
  const [sprite, setSprite] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    fetch(url)
      .then((res) => (res.ok ? res.text() : null))
      .then((text) => {
        if (live && text) setSprite(text);
      })
      // decoration only: without the sprite the backdrop just stays empty
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [url]);
  return sprite;
}

/** Enough rows to cover the viewport top to bottom plus a spare at each end. */
/**
 * A fresh random set of words for every row, drawn once per page load (on the
 * client, so it never has to match server markup). Rows added when the window
 * grows get their own draw; existing rows keep theirs, and each row keeps its
 * words as it is recycled from top to bottom.
 */
function useShuffledRows(count: number) {
  const [rows, setRows] = useState<string[][]>([]);
  useEffect(() => {
    setRows((prev) =>
      prev.length >= count
        ? prev
        : [
            ...prev,
            ...shuffledRows(rowsData.rows, count - prev.length, ROW_LENGTH),
          ],
    );
  }, [count]);
  return rows;
}

function useRowCount() {
  const [count, setCount] = useState(0);
  useEffect(() => {
    const measure = () => {
      setCount(Math.ceil(window.innerHeight / MIN_ROW_PITCH) + 2);
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
        const sliding = SLIDE_EVERY > 0 && mod(k, SLIDE_EVERY) === 0;
        const direction = sliding && mod(k / SLIDE_EVERY, 2) === 1 ? 1 : -1;
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
  const navigate = useNavigate();
  useEffect(() => {
    if (!ready) return;
    let frame = 0;
    let pointer: { x: number; y: number } | null = null;
    let active: HTMLElement | null = null;

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

    const isDoor = (glyph: HTMLElement | null) =>
      !!glyph && EASTER_EGG_WORDS.has(glyph.dataset.word ?? "");

    const setActive = (glyph: HTMLElement | null) => {
      if (glyph === active) return;
      // the backdrop takes no pointer events, so hint the door on the page
      document.documentElement.style.cursor = isDoor(glyph) ? "pointer" : "";
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
    const onScroll = () => {
      if (pointer) schedule();
    };
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0) return;
      if (e.target instanceof Element && e.target.closest(INTERACTIVE)) return;
      // dragging out a text selection isn't a click on the wall
      if (window.getSelection()?.toString()) return;
      const glyph = glyphAt(e.clientX, e.clientY);
      if (!isDoor(glyph)) return;
      // pop it on the way through — mouse only, phones don't pop
      if ((e as PointerEvent).pointerType === "mouse") setActive(glyph);
      // let the pop land before the page changes
      window.setTimeout(() => void navigate(EASTER_EGG_PATH), 280);
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    document.documentElement.addEventListener("pointerleave", onLeave);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("click", onClick);
    return () => {
      window.removeEventListener("click", onClick);
      window.removeEventListener("pointermove", onMove);
      document.documentElement.removeEventListener("pointerleave", onLeave);
      window.removeEventListener("scroll", onScroll);
      if (frame) cancelAnimationFrame(frame);
      setActive(null);
    };
  }, [ready, rowRefs, navigate]);
}

function mod(n: number, m: number) {
  return m > 0 ? ((n % m) + m) % m : 0;
}
