import { describe, expect, it } from "vitest";

import {
  clockGlyphs,
  GAME_MS,
  maxUp,
  newGame,
  scoreGlyphs,
  step,
  upTime,
  whack,
} from "./game";

const always = (v: number) => () => v;

describe("clockGlyphs", () => {
  it("reads 1:00 at the start of the minute", () => {
    expect(clockGlyphs(GAME_MS)).toEqual(["1", "colon", "0", "0"]);
  });

  it("rounds partial seconds up", () => {
    expect(clockGlyphs(59_001)).toEqual(["1", "colon", "0", "0"]);
    expect(clockGlyphs(59_000)).toEqual(["0", "colon", "5", "9"]);
    expect(clockGlyphs(9_500)).toEqual(["0", "colon", "1", "0"]);
  });

  it("stops at 0:00", () => {
    expect(clockGlyphs(-500)).toEqual(["0", "colon", "0", "0"]);
  });
});

describe("scoreGlyphs", () => {
  it("zero-pads to three digits", () => {
    expect(scoreGlyphs(7)).toEqual(["0", "0", "7"]);
    expect(scoreGlyphs(1234)).toEqual(["1", "2", "3", "4"]);
  });
});

describe("pacing", () => {
  it("speeds up and gets busier over the minute", () => {
    expect(upTime(0)).toBeGreaterThan(upTime(GAME_MS));
    expect(maxUp(0)).toBe(1);
    expect(maxUp(GAME_MS)).toBe(3);
  });
});

describe("step", () => {
  it("pops a soweli once the first pause is over", () => {
    const g = step(newGame(), 1000, always(0));
    expect(g.holes[0]).toMatchObject({ state: "up", pop: 1 });
    expect(g.holes.filter((h) => h.state === "up")).toHaveLength(1);
  });

  it("never pops more than allowed at once", () => {
    let g = newGame();
    for (let t = 0; t < 10_000; t += 50) g = step(g, t, Math.random);
    const up = g.holes.filter((h) => h.state !== "down").length;
    expect(up).toBeLessThanOrEqual(maxUp(10_000));
  });

  it("sinks a soweli when its time is up", () => {
    const g = step(newGame(), 1000, always(0));
    const later = step(g, 1000 + upTime(1000), always(0.99));
    expect(later.holes[0].state).toBe("down");
  });

  it("pops nothing once the minute is over", () => {
    const g = step({ ...newGame(), nextPopAt: 0 }, GAME_MS, always(0));
    expect(g.holes.every((h) => h.state === "down")).toBe(true);
  });
});

describe("whack", () => {
  it("scores a soweli that is up, once", () => {
    const g = step(newGame(), 1000, always(0));
    const hit = whack(g, 0, 1100);
    expect(hit.score).toBe(1);
    expect(hit.holes[0].state).toBe("hit");
    expect(whack(hit, 0, 1150).score).toBe(1);
  });

  it("ignores an empty hole", () => {
    const g = newGame();
    expect(whack(g, 4, 100)).toBe(g);
  });
});
