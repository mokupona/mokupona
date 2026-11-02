import type React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router";

import {
  clockGlyphs,
  GAME_MS,
  type Game,
  litSegments,
  newGame,
  scoreGlyphs,
  SEGMENTS,
  step,
  whack,
} from "./game";
import { type Sticker, stickerLayout } from "./stickers";

import rowsData from "~/features/sitelen/rows.json";
import { PaperPatterns, useSprite } from "~/features/sitelen/sitelen-backdrop";
import { cn } from "~/lib/utils";

const WORD_SPRITE = "/sitelen/sprite.svg";
const ARCADE_SPRITE = "/sitelen/arcade.svg";
const BEST_KEY = "musi-best";

/**
 * crumpled paper, as CSS backgrounds for the machine's body. Like the glyphs,
 * the tiles are drawn in the original cool violet; every part of the machine
 * carries `art-warm` to turn them onto the site's palette.
 */
const DARK_PAPER: React.CSSProperties = {
  backgroundColor: "rgb(69 25 140)",
  backgroundImage: "url(/sitelen/paper-dark.jpg)",
  backgroundSize: "180px",
};
const PALE_PAPER: React.CSSProperties = {
  backgroundColor: "rgb(233 229 240)",
  backgroundImage: "url(/sitelen/paper-pale.jpg)",
  backgroundSize: "220px",
};

/** keyboard layout of the 3×3 board: the numpad, top row 7 8 9 */
const KEY_TO_HOLE: Record<string, number> = {
  "7": 0,
  "8": 1,
  "9": 2,
  "4": 3,
  "5": 4,
  "6": 5,
  "1": 6,
  "2": 7,
  "3": 8,
};

type Phase = "ready" | "playing" | "over";

/**
 * Whack-a-soweli: torn-paper soweli pop out of a 3×3 board of holes on a
 * paper pinball cabinet, and you have one minute to bonk as many as you can
 * with an ilo hammer. Reached by clicking moku or pona on the landing page.
 */
export function Arcade() {
  const words = useSprite(WORD_SPRITE);
  const arcade = useSprite(ARCADE_SPRITE);
  const ready = words !== null && arcade !== null;

  const [phase, setPhase] = useState<Phase>("ready");
  const [game, setGame] = useState<Game>(newGame);
  const [msLeft, setMsLeft] = useState(GAME_MS);
  const [best, setBest] = useState<number | null>(null);
  const startedAt = useRef(0);

  useEffect(() => {
    setBest(readBest());
  }, []);

  const start = useCallback(() => {
    startedAt.current = performance.now();
    setGame(newGame());
    setMsLeft(GAME_MS);
    setPhase("playing");
  }, []);

  // the game clock: advance the board ~20 times a second
  useEffect(() => {
    if (phase !== "playing") return;
    const id = window.setInterval(() => {
      const elapsed = performance.now() - startedAt.current;
      setMsLeft(Math.max(0, GAME_MS - elapsed));
      setGame((g) => step(g, elapsed, Math.random));
      if (elapsed >= GAME_MS) setPhase("over");
    }, 50);
    return () => window.clearInterval(id);
  }, [phase]);

  // keep the best score once the minute is up
  useEffect(() => {
    if (phase !== "over") return;
    setBest((b) => {
      const next = Math.max(b ?? 0, game.score);
      writeBest(next);
      return next;
    });
  }, [phase, game.score]);

  const bonk = useCallback(
    (i: number) => {
      if (phase !== "playing") return;
      const elapsed = performance.now() - startedAt.current;
      setGame((g) => whack(g, i, elapsed));
    },
    [phase],
  );

  // numpad / number row: 7 8 9 / 4 5 6 / 1 2 3, space or enter to start
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const hole = KEY_TO_HOLE[e.key];
      if (hole !== undefined) bonk(hole);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [bonk]);

  // the ilo only takes over the pointer once the game is on
  const hammer = useHammer(phase === "playing");

  return (
    <div
      className={cn(
        "relative mx-auto w-full max-w-[34rem] touch-manipulation select-none",
        hammer.active && "cursor-none",
        "transition-opacity duration-700",
        ready ? "opacity-100" : "opacity-0",
      )}
      style={
        {
          "--smp-rim": "rgb(246 240 252)",
          "--smp-shadow": "rgb(43 18 56 / 0.25)",
          // a deep plum rather than black; the wall is the darker shade
          "--smp-hole": "rgb(72 40 92)",
          "--smp-hole-wall": "rgb(38 16 54)",
        } as React.CSSProperties
      }
      {...hammer.handlers}
    >
      <PaperPatterns />
      {ready ? (
        <div
          aria-hidden="true"
          className="absolute size-0 overflow-hidden"
          dangerouslySetInnerHTML={{ __html: words + arcade }}
        />
      ) : null}

      <Clock msLeft={phase === "ready" ? GAME_MS : msLeft} />

      {/* ----------------------------------------------------- backbox -- */}
      <div
        className="art-warm rounded-3xl p-2.5 shadow-lg md:p-3"
        style={DARK_PAPER}
      >
        <div
          className="relative aspect-[16/8] overflow-hidden rounded-2xl"
          style={PALE_PAPER}
        >
          <Stickers />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="rounded-xl p-1.5 shadow-md" style={DARK_PAPER}>
              <div
                className="flex flex-col items-center rounded-lg px-3 pt-1 pb-0.5"
                style={PALE_PAPER}
              >
                <span
                  // text, not artwork: undo the machine's hue shift
                  className="text-ink text-[0.65rem] font-semibold tracking-[0.2em] uppercase"
                  style={{
                    filter: "hue-rotate(calc(-1 * var(--art-hue-shift)))",
                  }}
                >
                  pona
                </span>
                <span
                  className="flex"
                  role="img"
                  aria-label={`score ${game.score}`}
                >
                  {scoreGlyphs(game.score).map((d, i) => (
                    <PopGlyph
                      key={i}
                      name={`digit-${d}`}
                      className="-mx-1 size-10 md:size-12"
                    />
                  ))}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* the neck between backbox and table */}
      <div className="art-warm mx-auto h-3 w-[86%]" style={DARK_PAPER} />

      {/* ---------------------------------------------------- playfield -- */}
      {/* the tilt shortens the table but not its layout box, so pull it up
          under the backbox; % margins track the width, as the table does */}
      <div className="relative" style={{ marginTop: "-19%" }}>
        <div
          className="art-warm rounded-t-3xl p-2.5 shadow-xl md:p-3.5"
          style={{
            ...DARK_PAPER,
            transform: "perspective(1100px) rotateX(24deg)",
            transformOrigin: "50% 100%",
          }}
        >
          <div
            className="grid grid-cols-3 gap-x-2 rounded-2xl px-3 pt-4 pb-1 md:gap-x-4 md:px-5"
            style={PALE_PAPER}
          >
            {game.holes.map((hole, i) => (
              <HoleCell
                key={i}
                index={i}
                state={hole.state}
                pop={hole.pop}
                onBonk={bonk}
              />
            ))}
          </div>
        </div>

        {phase !== "playing" ? (
          <Notice
            phase={phase}
            score={game.score}
            best={best}
            onStart={start}
          />
        ) : null}
      </div>

      {/* --------------------------------------------- front panel + legs -- */}
      <div
        className="relative flex h-14 items-center justify-between rounded-b-3xl px-6 shadow-lg md:h-16"
        style={{
          ...DARK_PAPER,
          // art-warm plus a shade darker: an inline filter replaces the class's
          filter: "hue-rotate(var(--art-hue-shift)) brightness(0.85)",
        }}
      >
        <span className="flex gap-1.5" aria-hidden="true">
          <span className="h-6 w-2 rounded-full bg-black/50 shadow-inner" />
          <span className="h-6 w-2 rounded-full bg-black/50 shadow-inner" />
        </span>
        <button
          type="button"
          onClick={start}
          disabled={phase === "playing"}
          aria-label="start"
          className="size-9 rounded-full border-2 border-[rgb(246_240_252)] shadow-[0_3px_0_rgb(20_6_40)] transition-transform active:translate-y-0.5 active:shadow-none disabled:opacity-60 md:size-10"
          style={{
            backgroundImage: "url(/sitelen/paper-light.jpg)",
            backgroundSize: "80px",
          }}
        />
      </div>
      <Legs />

      <p className="text-muted-foreground mt-6 text-center text-sm [@media(pointer:coarse)]:hidden">
        tip: the number keys work too — 7 8 9 / 4 5 6 / 1 2 3
      </p>

      <Hammer state={hammer} />
    </div>
  );
}

/* ------------------------------------------------------------- holes -- */

function HoleCell({
  index,
  state,
  pop,
  onBonk,
}: {
  index: number;
  state: Game["holes"][number]["state"];
  pop: number;
  onBonk: (i: number) => void;
}) {
  return (
    <button
      type="button"
      tabIndex={-1}
      aria-label={state === "up" ? "soweli! bonk it" : "empty hole"}
      className="relative aspect-square cursor-[inherit] outline-none"
      onPointerDown={() => onBonk(index)}
    >
      <svg
        viewBox="-8 -8 116 116"
        className="absolute inset-0 size-full"
        aria-hidden="true"
      >
        <use href="#smp-hole" />
      </svg>
      {/* the soweli rises from the middle of the hole: clip only below */}
      <span
        className="pointer-events-none absolute inset-x-0 top-[-35%] bottom-1/2"
        style={{ clipPath: "inset(-50% -50% 0 -50%)" }}
      >
        <svg
          viewBox="-8 -8 116 116"
          aria-hidden="true"
          className={cn(
            "absolute bottom-0 left-[6%] w-[88%] origin-bottom transition-transform motion-reduce:transition-none",
            state === "up" && "duration-200 ease-[cubic-bezier(.3,1.6,.5,1)]",
            state === "down" && "duration-150 ease-in",
            state === "hit" && "duration-100",
          )}
          style={{
            transform:
              state === "up"
                ? "translateY(14%)"
                : state === "hit"
                  ? "translateY(34%) scale(1.1, 0.7)"
                  : "translateY(115%)",
          }}
        >
          <use href="#smp-soweli" />
        </svg>
      </span>
      {state === "hit" ? (
        <svg
          key={pop}
          viewBox="-8 -8 116 116"
          aria-hidden="true"
          className="animate-glyph-burst pointer-events-none absolute top-[-20%] left-[15%] w-[70%]"
        >
          <use href="#smp-namako" />
        </svg>
      ) : null}
    </button>
  );
}

/* ------------------------------------------------------------- clock -- */

function Clock({ msLeft }: { msLeft: number }) {
  const glyphs = clockGlyphs(msLeft);
  const seconds = Math.ceil(msLeft / 1000);
  return (
    <div className="art-warm mb-1 flex flex-col items-center">
      <div
        className="rounded-2xl p-2 shadow-lg"
        style={DARK_PAPER}
        role="timer"
        aria-label={`${seconds} seconds left`}
      >
        <div
          className="flex items-center rounded-xl px-3 py-1"
          style={PALE_PAPER}
        >
          {glyphs.map((g, i) =>
            g === "colon" ? (
              <svg
                key={i}
                viewBox="-8 -8 116 116"
                aria-hidden="true"
                className="-mx-6 h-20 w-20 shrink-0 md:h-24 md:w-24"
              >
                <use href="#smp-seg-colon" />
              </svg>
            ) : (
              <SegmentDigit key={i} digit={g} />
            ),
          )}
        </div>
      </div>
      {/* struts holding the clock above the backbox */}
      <div className="flex w-40 justify-between" aria-hidden="true">
        <span className="h-5 w-2.5 rounded-b-full" style={DARK_PAPER} />
        <span className="h-5 w-2.5 rounded-b-full" style={DARK_PAPER} />
      </div>
    </div>
  );
}

/**
 * One digit of the clock's seven-segment display, cut from torn paper. The
 * unlit bars stay faintly visible, like an LCD; the lit ones pop in with a
 * wiggle whenever the digit changes.
 */
function SegmentDigit({ digit }: { digit: string }) {
  return (
    <span className="relative block h-20 w-16 shrink-0 md:h-24 md:w-20">
      <svg
        viewBox="-8 -8 116 116"
        aria-hidden="true"
        preserveAspectRatio="xMidYMid slice"
        className="absolute inset-0 size-full opacity-[0.13]"
      >
        {SEGMENTS.map((s) => (
          <use key={s} href={`#smp-seg-${s}`} />
        ))}
      </svg>
      <PopSwap
        value={digit}
        className="absolute inset-0"
        render={(d) => (
          <svg
            viewBox="-8 -8 116 116"
            preserveAspectRatio="xMidYMid slice"
            className="size-full"
          >
            {litSegments(d).map((s) => (
              <use key={s} href={`#smp-seg-${s}`} />
            ))}
          </svg>
        )}
      />
    </span>
  );
}

/** A torn-paper glyph that pops in with a wiggle whenever `name` changes. */
function PopGlyph({ name, className }: { name: string; className?: string }) {
  return (
    <PopSwap
      value={name}
      className={cn("relative block shrink-0", className)}
      render={(n) => (
        <svg viewBox="-8 -8 116 116" className="size-full">
          <use href={`#smp-${n}`} />
        </svg>
      )}
    />
  );
}

/**
 * Renders `render(value)`, and whenever `value` changes pops the new one in
 * with a wiggle while the old one twists away underneath it.
 */
function PopSwap({
  value,
  render,
  className,
}: {
  value: string;
  render: (value: string) => React.ReactNode;
  className?: string;
}) {
  const [items, setItems] = useState([{ value, key: 0, out: false }]);
  const [shown, setShown] = useState(value);

  if (value !== shown) {
    setShown(value);
    setItems((prev) => [
      ...prev.filter((it) => !it.out).map((it) => ({ ...it, out: true })),
      { value, key: (prev[prev.length - 1]?.key ?? 0) + 1, out: false },
    ]);
  }

  const leaving = items.some((it) => it.out);
  useEffect(() => {
    if (!leaving) return;
    const t = window.setTimeout(
      () => setItems((prev) => prev.filter((it) => !it.out)),
      260,
    );
    return () => window.clearTimeout(t);
  }, [leaving]);

  return (
    <span aria-hidden="true" className={className}>
      {items.map((it) => (
        <span
          key={it.key}
          className={cn(
            "absolute inset-0 motion-reduce:animate-none",
            it.out ? "animate-glyph-out" : "animate-glyph-in",
          )}
        >
          {render(it.value)}
        </span>
      ))}
    </span>
  );
}

/* ---------------------------------------------------------- stickers -- */

/** glyphs stuck on the backboard — a fresh pick and layout every visit */
function Stickers() {
  const [stickers, setStickers] = useState<Sticker[]>([]);

  useEffect(() => {
    const pool = rowsData.rows
      .flat()
      .filter((w) => w !== "soweli" && w !== "ilo");
    setStickers(stickerLayout(pool));
  }, []);

  return (
    <div aria-hidden="true" className="absolute inset-0">
      {stickers.map((s, i) => (
        <svg
          key={i}
          viewBox="-8 -8 116 116"
          className="absolute aspect-square"
          style={{
            // x/y are centres; the board is twice as wide as it is tall, so
            // half a sticker's width is `size`% of the board's height
            left: `${s.x - s.size / 2}%`,
            top: `${s.y - s.size}%`,
            width: `${s.size}%`,
            transform: `rotate(${s.turn}deg)`,
          }}
        >
          <use href={`#smp-${s.word}`} />
        </svg>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------ notice -- */

function Notice({
  phase,
  score,
  best,
  onStart,
}: {
  phase: Exclude<Phase, "playing">;
  score: number;
  best: number | null;
  onStart: () => void;
}) {
  return (
    <div className="absolute inset-0 flex items-center justify-center p-6">
      <div
        className="animate-glyph-in flex max-w-xs flex-col items-center gap-3 rounded-2xl px-6 py-5 text-center shadow-xl"
        style={PALE_PAPER}
        role="status"
      >
        {phase === "ready" ? (
          <>
            <p className="text-ink text-xl font-semibold">bonk the soweli!</p>
            <p className="text-ink text-sm">you have one minute.</p>
          </>
        ) : (
          <>
            <p className="text-ink text-xl font-semibold">tenpo li pini!</p>
            <p className="text-ink text-sm">
              time&apos;s up — you bonked{" "}
              <strong className="font-semibold">{score}</strong> soweli.
              {best !== null && best > 0 ? (
                <>
                  <br />
                  best so far: <strong className="font-semibold">{best}</strong>
                </>
              ) : null}
            </p>
          </>
        )}
        <button
          type="button"
          onClick={onStart}
          className="bg-primary text-primary-foreground hover:bg-primary/90 h-10 rounded-full px-6 text-sm font-semibold transition-colors"
        >
          {phase === "ready" ? "start" : "play again"}
        </button>
        {phase === "over" ? (
          <Link
            to="/"
            className="text-ink text-sm underline-offset-4 hover:underline"
          >
            back to moku pona
          </Link>
        ) : null}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------- legs -- */

function Legs() {
  return (
    <div className="art-warm relative h-24 md:h-28" aria-hidden="true">
      {/* back legs, set in and shaded */}
      <span
        className="absolute top-0 left-[16%] h-[82%] w-[4%] rounded-b-full"
        style={{ ...DARK_PAPER, filter: "brightness(0.6)" }}
      />
      <span
        className="absolute top-0 right-[16%] h-[82%] w-[4%] rounded-b-full"
        style={{ ...DARK_PAPER, filter: "brightness(0.6)" }}
      />
      <span
        className="absolute top-[45%] right-[17%] left-[17%] h-2 rounded-full"
        style={{ ...DARK_PAPER, filter: "brightness(0.6)" }}
      />
      {/* front legs, splayed a touch, with feet */}
      {(["left", "right"] as const).map((side) => (
        <span
          key={side}
          className={cn(
            "absolute top-0 h-full w-[6%] rounded-b-xl",
            side === "left" ? "left-[3%]" : "right-[3%]",
          )}
          style={{
            ...DARK_PAPER,
            transform: `rotate(${side === "left" ? 3 : -3}deg)`,
            transformOrigin: "50% 0",
          }}
        >
          <span
            className="absolute -bottom-1 left-1/2 h-2.5 w-[220%] -translate-x-1/2 rounded-full"
            style={{ ...DARK_PAPER, filter: "brightness(0.75)" }}
          />
        </span>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------ hammer -- */

/** px; the ilo glyph's on-screen size */
const HAMMER = 120;
const K = HAMMER / 116;
/** where the handle's end sits in the glyph (viewBox units, +8 offset) */
const GRIP = { x: 58 * K, y: 98 * K };
/** the swing, in degrees — the head lands on the pointer at this angle */
const SWING = -55;
/** the grip sits here relative to the pointer, so the swing lands true */
const GRIP_OFFSET = {
  x: -59 * K * Math.sin((SWING * Math.PI) / 180),
  y: 59 * K * Math.cos((SWING * Math.PI) / 180),
};

interface HammerState {
  active: boolean;
  swinging: number;
  ref: React.RefObject<HTMLDivElement | null>;
  handlers: Pick<
    React.HTMLAttributes<HTMLDivElement>,
    "onPointerMove" | "onPointerLeave" | "onPointerDown"
  >;
}

/**
 * The ilo follows the pointer around the machine and swings on a press —
 * only while `enabled`; otherwise the pointer is the ordinary cursor.
 */
function useHammer(enabled: boolean): HammerState {
  const ref = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(false);
  const [swinging, setSwinging] = useState(0);
  const touchHide = useRef(0);

  // put the hammer down when the game ends (or before it starts)
  useEffect(() => {
    if (!enabled) setActive(false);
  }, [enabled]);

  const place = (e: React.PointerEvent) => {
    const el = ref.current;
    if (!el) return;
    el.style.transform = `translate3d(${e.clientX + GRIP_OFFSET.x}px, ${e.clientY + GRIP_OFFSET.y}px, 0)`;
  };

  useEffect(() => {
    if (!swinging) return;
    const t = window.setTimeout(() => setSwinging(0), 110);
    return () => window.clearTimeout(t);
  }, [swinging]);

  useEffect(() => () => window.clearTimeout(touchHide.current), []);

  return {
    active,
    swinging,
    ref,
    handlers: {
      onPointerMove: (e) => {
        if (!enabled || e.pointerType !== "mouse") return;
        place(e);
        setActive(true);
      },
      onPointerLeave: (e) => {
        if (e.pointerType === "mouse") setActive(false);
      },
      onPointerDown: (e) => {
        if (!enabled) return;
        place(e);
        setActive(true);
        setSwinging((n) => n + 1);
        if (e.pointerType !== "mouse") {
          // on touch the hammer appears where you tap, then lifts away
          window.clearTimeout(touchHide.current);
          touchHide.current = window.setTimeout(() => setActive(false), 450);
        }
      },
    },
  };
}

function Hammer({ state }: { state: HammerState }) {
  return (
    <div
      ref={state.ref}
      aria-hidden="true"
      className={cn(
        "art-warm pointer-events-none fixed top-0 left-0 z-50 transition-opacity duration-150",
        state.active ? "opacity-100" : "opacity-0",
      )}
    >
      <svg
        viewBox="-8 -8 116 116"
        className="absolute drop-shadow-md"
        style={{
          width: HAMMER,
          height: HAMMER,
          left: -GRIP.x,
          top: -GRIP.y,
          transformOrigin: `${GRIP.x}px ${GRIP.y}px`,
          transform: `rotate(${state.swinging ? SWING : 0}deg)`,
          transition: `transform ${state.swinging ? 70 : 160}ms ease-out`,
        }}
      >
        <use href="#smp-ilo" />
      </svg>
    </div>
  );
}

/* ------------------------------------------------------------- utils -- */

function readBest(): number | null {
  try {
    const v = Number(window.localStorage.getItem(BEST_KEY));
    return Number.isFinite(v) && v > 0 ? v : null;
  } catch {
    return null;
  }
}

function writeBest(n: number) {
  try {
    window.localStorage.setItem(BEST_KEY, String(n));
  } catch {
    // private mode or blocked storage: the best score just won't stick
  }
}
