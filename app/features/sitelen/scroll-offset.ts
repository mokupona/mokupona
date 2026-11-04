/**
 * Where a scroll-linked row sits for a given scroll position.
 *
 * Each row repeats its glyphs, so it can slide forever: the offset wraps
 * within one copy's width. `direction` -1 slides left as the page scrolls
 * down, +1 slides right; scrolling back up runs it in reverse because the
 * offset is a pure function of the scroll position, not of time.
 *
 * Returns a translateX in px, always in [-copyWidth, 0), so the row's left
 * edge is never visible inside the band.
 */
export function rowOffset(
  scrollY: number,
  direction: -1 | 1,
  copyWidth: number,
  speed: number,
  phase = 0,
) {
  if (copyWidth <= 0) return 0;
  const travelled = direction * scrollY * speed + phase;
  const wrapped = ((travelled % copyWidth) + copyWidth) % copyWidth;
  return wrapped - copyWidth;
}

/**
 * Vertical layout for an endless wall of `count` rows drifted up by `drift`
 * px. Rows are numbered k = 0, 1, 2, … down the (infinite) wall; only the
 * `count` rows starting one above the screen exist, each DOM slot i showing
 * the one row k with k ≡ i (mod count). As the wall drifts, a row scrolling
 * off the top is handed to the bottom.
 *
 * `slot(i)` gives the wall row a slot shows; `top(k)` its y in px.
 */
export function wallRows(drift: number, pitch: number, count: number) {
  const first = Math.floor(drift / pitch) - 1;
  return {
    slot: (i: number) => first + ((((i - first) % count) + count) % count),
    top: (k: number) => k * pitch - drift,
  };
}
