import { describe, expect, it } from "vitest";

import { stickerLayout } from "./stickers";

const WORDS = Array.from({ length: 40 }, (_, i) => `w${i}`);

describe("stickerLayout", () => {
  it("fills every cell but the ones behind the score window", () => {
    const stickers = stickerLayout(WORDS);
    expect(stickers.length).toBeGreaterThanOrEqual(14);
    expect(stickers.length).toBeLessThan(18);
  });

  it("never repeats a word", () => {
    const words = stickerLayout(WORDS).map((s) => s.word);
    expect(new Set(words).size).toBe(words.length);
  });

  it("keeps sticker centres out of the score window", () => {
    for (let run = 0; run < 50; run++) {
      for (const s of stickerLayout(WORDS)) {
        const behindWindow = s.x > 38 && s.x < 62 && s.y > 28 && s.y < 72;
        expect(behindWindow).toBe(false);
      }
    }
  });

  it("spreads stickers over the whole board", () => {
    const stickers = stickerLayout(WORDS);
    // every third of the width gets a fair share
    for (const [lo, hi] of [
      [0, 33.4],
      [33.4, 66.7],
      [66.7, 101],
    ]) {
      const n = stickers.filter((s) => s.x >= lo! && s.x < hi!).length;
      expect(n).toBeGreaterThanOrEqual(3);
    }
  });

  it("is reproducible for a given random source", () => {
    let seed = 1;
    const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
    const a = stickerLayout(WORDS, rand);
    seed = 1;
    expect(stickerLayout(WORDS, rand)).toEqual(a);
  });
});
