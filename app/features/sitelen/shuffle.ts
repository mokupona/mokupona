/**
 * `count` rows of `length` glyph words, each an independent random pick
 * (without repeats inside a row) from every word in `lists`. Called once per
 * page load, so the backdrop is laid out differently each visit.
 */
export function shuffledRows(
  lists: readonly (readonly string[])[],
  count: number,
  length: number,
  random: () => number = Math.random,
) {
  const pool = [...new Set(lists.flat())];
  return Array.from({ length: count }, () => {
    const words = [...pool];
    // Fisher–Yates, stopping once the first `length` slots are settled
    for (let i = 0; i < Math.min(length, words.length - 1); i++) {
      const j = i + Math.floor(random() * (words.length - i));
      [words[i], words[j]] = [words[j]!, words[i]!];
    }
    return words.slice(0, length);
  });
}
