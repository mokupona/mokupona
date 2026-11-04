"""Raster contact sheet of the generated glyphs (PNG), composited from the same
masks the SVGs are traced from — handy where an SVG viewer isn't to hand."""

from __future__ import annotations

import argparse
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

import generate as g
from glyphs import GLYPHS
from textures import colourways

PAPER = np.array([247, 250, 231], float)


def _hex(h):
    return np.array([int(h[i : i + 2], 16) for i in (1, 3, 5)], float)


def _tiled(tex: np.ndarray, offset) -> np.ndarray:
    scale = g.TEXTURE_UNITS * g.PX / tex.shape[0]
    t = ndimage.zoom(tex, (scale, scale, 1), order=1, mode="grid-wrap", grid_mode=True)
    reps = g.SIZE // t.shape[0] + 2
    big = np.tile(t, (reps, reps, 1))
    ox, oy = (int(v * g.PX) % t.shape[0] for v in offset)
    return big[oy : oy + g.SIZE, ox : ox + g.SIZE]


def composite(word: str, cw: dict) -> Image.Image:
    rng = np.random.default_rng(g.seed_for(word))
    base, dark = g.rasterise(GLYPHS[word])
    body, outer = g.tear(base, rng, rim_max=3.0)
    dbody, douter = g.tear(dark, rng, rim_max=1.8)
    tilt = float(rng.uniform(-7, 7))
    offset = rng.uniform(0, g.TEXTURE_UNITS, 2)

    img = np.broadcast_to(PAPER, (g.SIZE, g.SIZE, 3)).copy()
    shadow = ndimage.shift((outer | douter).astype(float), (1.6 * g.PX, 1.1 * g.PX), order=0)
    shadow = ndimage.gaussian_filter(shadow, 1.1 * g.PX) * 0.28
    img = img * (1 - shadow[..., None]) + _hex("#2B1238") * shadow[..., None]

    def lay(mask, colour):
        nonlocal img
        a = ndimage.gaussian_filter(mask.astype(float), 0.7)[..., None]
        img = img * (1 - a) + colour * a

    lay(outer, _hex(cw["rim"]))
    lay(body, _tiled(cw["light"], offset))
    lay(douter, _hex(cw["rim"]) * 0.9 + img * 0.1)
    lay(dbody, _tiled(cw["dark"], offset + 23))
    im = Image.fromarray(np.clip(img, 0, 255).astype(np.uint8))
    return im.rotate(-tilt, resample=Image.BICUBIC, fillcolor=tuple(int(c) for c in PAPER))


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("words", nargs="*")
    ap.add_argument("--colourway", action="append")
    ap.add_argument("--cell", type=int, default=220)
    ap.add_argument("--cols", type=int, default=6)
    args = ap.parse_args()
    words = args.words or sorted(GLYPHS)
    ways = colourways()
    names = args.colourway or ["violet"]
    for name in names:
        rows = -(-len(words) // args.cols)
        sheet = Image.new("RGB", (args.cols * args.cell, rows * args.cell), tuple(int(c) for c in PAPER))
        for i, w in enumerate(words):
            tile = composite(w, ways[name]).resize((args.cell, args.cell), Image.LANCZOS)
            x, y = (i % args.cols) * args.cell, (i // args.cols) * args.cell
            sheet.paste(tile, (x, y))
            ImageDraw.Draw(sheet).text((x + 6, y + args.cell - 16), w, fill=(74, 68, 102))
        path = g.OUT / f"sheet-{name}.png"
        sheet.save(path)
        print(path)


if __name__ == "__main__":
    main()
