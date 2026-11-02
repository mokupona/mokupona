/**
 * Rules for the /musi whack-a-soweli easter egg, kept free of React so they
 * can be tested on their own.
 */

export const GAME_MS = 60_000;
export const HOLES = 9;

export interface Hole {
  /** "up" waits to be hit; "hit" plays the bonk before sinking */
  state: "down" | "up" | "hit";
  /** when the current state ends, in ms since the game started */
  until: number;
  /** bumps on every pop, so each appearance remounts its animation */
  pop: number;
}

export interface Game {
  holes: Hole[];
  score: number;
  /** ms since start at which the next soweli may pop up */
  nextPopAt: number;
}

export function newGame(): Game {
  return {
    holes: Array.from({ length: HOLES }, () => ({
      state: "down",
      until: 0,
      pop: 0,
    })),
    score: 0,
    nextPopAt: 600,
  };
}

/** 0 at the start of the minute, 1 at the end. */
function progress(elapsed: number) {
  return Math.min(1, Math.max(0, elapsed / GAME_MS));
}

/** How long a soweli stays up: generous at first, snappy by the end. */
export function upTime(elapsed: number) {
  return Math.round(1150 - 550 * progress(elapsed));
}

/** How many may be up at once — the last stretch gets busy. */
export function maxUp(elapsed: number) {
  const p = progress(elapsed);
  return p < 0.35 ? 1 : p < 0.75 ? 2 : 3;
}

/** The pause before the next pop, shrinking as the minute runs out. */
export function popGap(elapsed: number, rand: () => number) {
  const p = progress(elapsed);
  return Math.round((380 + rand() * 520) * (1 - 0.45 * p));
}

/**
 * Advance the game to `elapsed` ms: sink the soweli whose time ran out and
 * pop new ones. Returns a new Game; the input is left alone.
 */
export function step(game: Game, elapsed: number, rand: () => number): Game {
  const holes = game.holes.map((h) =>
    h.state !== "down" && elapsed >= h.until
      ? { ...h, state: "down" as const }
      : h,
  );
  let { nextPopAt } = game;

  const up = holes.filter((h) => h.state !== "down").length;
  if (elapsed < GAME_MS && elapsed >= nextPopAt && up < maxUp(elapsed)) {
    const free = holes.flatMap((h, i) => (h.state === "down" ? [i] : []));
    const i = free[Math.floor(rand() * free.length)];
    if (i !== undefined) {
      holes[i] = {
        state: "up",
        until: elapsed + upTime(elapsed),
        pop: holes[i].pop + 1,
      };
    }
    nextPopAt = elapsed + popGap(elapsed, rand);
  }

  return { ...game, holes, nextPopAt };
}

/** Bonk the soweli in hole `i`, if there is one up to bonk. */
export function whack(game: Game, i: number, elapsed: number): Game {
  const hole = game.holes[i];
  if (!hole || hole.state !== "up") return game;
  const holes = game.holes.slice();
  holes[i] = { ...hole, state: "hit", until: elapsed + 380 };
  return { ...game, holes, score: game.score + 1 };
}

/**
 * The clock face for `msLeft`, as glyph names: "1", "colon", "0", "0".
 * Rounds up, so the clock reads 1:00 at the start and 0:00 only at the end.
 */
export function clockGlyphs(msLeft: number): string[] {
  const total = Math.max(0, Math.ceil(msLeft / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return [
    String(minutes),
    "colon",
    String(Math.floor(seconds / 10)),
    String(seconds % 10),
  ];
}

/** A score as glyph names, zero-padded to `width` digits. */
export function scoreGlyphs(score: number, width = 3): string[] {
  return String(Math.max(0, Math.floor(score)))
    .padStart(width, "0")
    .split("");
}
