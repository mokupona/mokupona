/**
 * Where the glyph stickers go on the arcade's backboard.
 *
 * Pure scatter clumps — some corners end up crowded, others bare — so the
 * stickers sit on a loose grid instead: 6 columns × 3 rows, alternate rows
 * shifted half a cell (a brick pattern, so no columns line up), each sticker
 * jittered inside its cell and turned at random. Cells behind the score
 * window in the middle are left empty.
 */

export interface Sticker {
  word: string;
  /** centre, in % of the backboard's width / height */
  x: number;
  y: number;
  /** width, in % of the backboard's width */
  size: number;
  /** rotation in degrees */
  turn: number;
}

const COLS = 6;
const ROWS = 3;
/** how far a sticker may wander from its cell centre, as a share of the cell */
const JITTER = 0.22;
/** the score window, in % of the backboard: no sticker centres in here */
const WINDOW = { left: 38, right: 62, top: 28, bottom: 72 };

export function stickerLayout(
  words: readonly string[],
  random: () => number = Math.random,
): Sticker[] {
  const cellW = 100 / COLS;
  const cellH = 100 / ROWS;
  const pool = shuffled(words, random);
  const out: Sticker[] = [];

  for (let row = 0; row < ROWS; row++) {
    const shift = row % 2 === 1 ? cellW / 2 : 0;
    for (let col = 0; col < COLS; col++) {
      const cx = (col + 0.5) * cellW + shift;
      const cy = (row + 0.5) * cellH;
      if (
        cx > WINDOW.left &&
        cx < WINDOW.right &&
        cy > WINDOW.top &&
        cy < WINDOW.bottom
      ) {
        continue;
      }
      const word = pool[out.length % pool.length];
      if (word === undefined) return out;
      out.push({
        word,
        x: cx + (random() * 2 - 1) * JITTER * cellW,
        y: cy + (random() * 2 - 1) * JITTER * cellH,
        size: 14 + random() * 5,
        turn: Math.round(random() * 360 - 180),
      });
    }
  }
  return out;
}

function shuffled<T>(xs: readonly T[], random: () => number): T[] {
  const out = xs.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}
