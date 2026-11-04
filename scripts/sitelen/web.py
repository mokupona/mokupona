"""Web build of sitelen moku pona for the landing page.

    python3 scripts/sitelen/web.py

Writes public/sitelen/sprite.svg — one <symbol> per word in
app/features/sitelen/rows.json — plus the shared paper textures. Unlike the
standalone SVGs, the symbols carry no texture of their own: their fills point
at page-level patterns (#smp-paper-l0..3, #smp-paper-d) that the component
defines once, so the texture downloads once however many glyphs are on screen.
"""

from __future__ import annotations

import json
import re
from pathlib import Path

import numpy as np
from PIL import Image

import generate as g
from textures import colourways

ROOT = g.ROOT
ROWS = ROOT / "app" / "features" / "sitelen" / "rows.json"
OUT = ROOT / "public" / "sitelen"
LIGHT_VARIANTS = 4  # texture offsets, so neighbouring glyphs don't show the same patch


def _short(path: str) -> str:
    """One decimal is plenty at on-screen sizes and halves the file."""
    return re.sub(r"-?\d+\.\d+", lambda m: f"{float(m.group()):.1f}", path)


def symbol(word: str, index: int) -> str:
    # coarser tracing than the print files: ~0.2 units, invisible at screen size
    geo = g.build_geometry(word, eps=1.6)
    outer, body = _short(geo["outer"]), _short(geo["body"])
    d_outer, d_body = _short(geo["dark_outer"]), _short(geo["dark_body"])
    dark = ""
    if d_body:
        dark = f'<path d="{d_outer}" fill="var(--smp-rim)" opacity="0.9"/><path d="{d_body}" fill="url(#smp-paper-d)"/>'
    return (
        f'<symbol id="smp-{word}" viewBox="-8 -8 116 116">'
        f'<g transform="rotate({geo["tilt"]} 50 50)">'
        f'<path d="{outer}{d_outer}" fill="var(--smp-shadow)" transform="translate(1.2 1.8)"/>'
        f'<path d="{outer}" fill="var(--smp-rim)"/>'
        f'<path d="{body}" fill="url(#smp-paper-l{index % LIGHT_VARIANTS})"/>'
        f"{dark}</g></symbol>"
    )


def save_texture(rgb: np.ndarray, path: Path) -> None:
    Image.fromarray(np.clip(rgb, 0, 255).astype(np.uint8)).resize((256, 256), Image.LANCZOS).save(
        path, "JPEG", quality=74, optimize=True, progressive=True
    )


def main() -> None:
    rows = json.loads(ROWS.read_text())["rows"]
    words = list(dict.fromkeys(w for row in rows for w in row))
    OUT.mkdir(parents=True, exist_ok=True)
    symbols = "".join(symbol(w, i) for i, w in enumerate(words))
    (OUT / "sprite.svg").write_text(f'<svg xmlns="http://www.w3.org/2000/svg">{symbols}</svg>\n')
    cw = colourways()["violet"]
    save_texture(cw["light"], OUT / "paper-light.jpg")
    save_texture(cw["dark"], OUT / "paper-dark.jpg")
    for f in sorted(OUT.iterdir()):
        print(f"{f.name:>18}  {f.stat().st_size // 1024} KB")


if __name__ == "__main__":
    main()
