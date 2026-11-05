"""Writes the torn-paper edge used on photos (the `paper-photo` utility).

    python3 scripts/artwork/torn_photo.py

Two SVGs in public/paper, stretched to the photo's box at display time:

- torn-photo-rim.svg: the light paper rim with its offset shadow, drawn
  behind the photo, in the same colours as the CTAs' torn-rim.svg
- torn-photo-mask.svg: a slightly smaller torn outline the photo is
  clipped to, so a ragged band of rim shows all the way round

The buttons' shapes are drawn for a 200x52 box; stretched over a 3:2 photo
their side edges smear, so photos get their own pair at 300x200. Seeded, so
re-running gives the same files.
"""

import random
from pathlib import Path

W, H = 300, 200
STEP = 3.0  # units between points along an edge
OUT = Path(__file__).resolve().parents[2] / "public" / "paper"


def torn_outline(rng: random.Random, inset: float, depth: float) -> str:
    """A closed path around the box, `inset` from its edge, each point
    pushed in by up to `depth` (a random walk, with the odd deeper nick)."""
    points: list[tuple[float, float]] = []
    walk = depth / 2

    def push() -> float:
        nonlocal walk
        walk += rng.uniform(-depth / 3, depth / 3)
        walk = min(max(walk, 0.0), depth)
        nick = rng.uniform(depth * 0.4, depth * 0.9) if rng.random() < 0.03 else 0
        return inset + walk + nick

    def edge(x0, y0, x1, y1, nx, ny):
        length = max(abs(x1 - x0), abs(y1 - y0))
        n = max(2, round(length / STEP))
        for i in range(n):
            t = i / n
            d = push()
            points.append((x0 + (x1 - x0) * t + nx * d, y0 + (y1 - y0) * t + ny * d))

    edge(0, 0, W, 0, 0, 1)  # top, pushed down
    edge(W, 0, W, H, -1, 0)  # right, pushed left
    edge(W, H, 0, H, 0, -1)  # bottom, pushed up
    edge(0, H, 0, 0, 1, 0)  # left, pushed right
    # each edge only pushes along its own normal, so pull the corners in too
    clamped = [
        (min(max(x, inset), W - inset), min(max(y, inset), H - inset))
        for x, y in points
    ]
    coords = " ".join(f"{x:.1f} {y:.1f}" for x, y in clamped)
    return f"M{coords}Z"


def svg(paths: str) -> str:
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" '
        f'preserveAspectRatio="none">{paths}</svg>\n'
    )


def main() -> None:
    rng = random.Random(20261105)
    # the rim keeps clear of the box edge so its offset shadow fits inside
    rim = torn_outline(rng, inset=2.4, depth=2.0)
    mask = torn_outline(rng, inset=4.6, depth=3.0)

    (OUT / "torn-photo-rim.svg").write_text(
        svg(
            f'<path d="{rim}" fill="rgb(43 18 56 / 0.2)" transform="translate(1.4 2)"/>'
            f'<path d="{rim}" fill="rgb(246 240 252)"/>'
        )
    )
    (OUT / "torn-photo-mask.svg").write_text(svg(f'<path d="{mask}"/>'))


if __name__ == "__main__":
    main()
