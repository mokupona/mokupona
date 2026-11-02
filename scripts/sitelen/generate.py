"""Generate sitelen moku pona: torn purple-paper glyphs as SVG.

    python3 scripts/sitelen/generate.py                # every glyph, every colourway
    python3 scripts/sitelen/generate.py pona jan       # just these glyphs
    python3 scripts/sitelen/generate.py --colourway violet

Pipeline per glyph: rasterise the strokes, fill enclosed counters, warp the
edges with seeded noise so they look torn, grow a pale fibrous rim (the paper's
white core where it ripped), trace everything back to vector paths, and fill
those paths with the crinkled-paper texture. The seed comes from the word, so
reruns produce identical files.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
from pathlib import Path

import contourpy
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

from glyphs import GLYPHS
from textures import colourways, to_data_uri

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "sitelen-moku-pona"

PX = 8  # raster pixels per glyph unit
PAD = 8  # units of margin around the 0..100 grid, room for tears and shadow
SIZE = (100 + 2 * PAD) * PX
BASE_SIZE = SIZE  # noise feature counts are tuned for this canvas; bigger canvases scale them

STROKE = 9.0  # light paper strip width, in units
DARK_STROKE = 7.0
TEXTURE_UNITS = 64  # one texture tile spans this many glyph units


# ---------------------------------------------------------------- raster ----

def _to_px(p):
    return ((p[0] + PAD) * PX, (p[1] + PAD) * PX)


def _stroke(draw: ImageDraw.ImageDraw, pts, width: float) -> None:
    px = [_to_px(p) for p in pts]
    w = width * PX
    draw.line(px, fill=255, width=int(round(w)), joint="curve")
    r = w / 2
    for x, y in px:  # round caps and joins
        draw.ellipse((x - r, y - r, x + r, y + r), fill=255)


def rasterise(glyph: dict) -> tuple[np.ndarray, np.ndarray]:
    base = Image.new("L", (SIZE, SIZE), 0)
    dark = Image.new("L", (SIZE, SIZE), 0)
    bd, dd = ImageDraw.Draw(base), ImageDraw.Draw(dark)
    for pts in glyph.get("base", []):
        _stroke(bd, pts, STROKE)
    for pts in glyph.get("fill", []):
        bd.polygon([_to_px(p) for p in pts], fill=255)
    for pts in glyph.get("dark", []):
        _stroke(dd, pts, DARK_STROKE)
    for x, y, r, layer in glyph.get("dots", []):
        cx, cy = _to_px((x, y))
        target = dd if layer == "dark" else bd
        target.ellipse((cx - r * PX, cy - r * PX, cx + r * PX, cy + r * PX), fill=255)
    b = np.asarray(base) > 127
    # closed shapes are cut out whole: fill every fully enclosed counter —
    # unless the glyph asks to keep them (numerals: a 0 or an 8 needs its holes)
    if not glyph.get("keep_counters"):
        b = ndimage.binary_fill_holes(b)
    return b, np.asarray(dark) > 127


# ----------------------------------------------------------------- noise ----

def _noise(rng: np.random.Generator, cells: int) -> np.ndarray:
    """Smooth value noise over the canvas, roughly in -1..1."""
    # keep features the same physical size on a larger canvas (logos)
    cells = max(2, round(cells * SIZE / BASE_SIZE))
    grid = rng.uniform(-1, 1, (cells + 3, cells + 3))
    big = ndimage.zoom(grid, SIZE / cells, order=3)
    off = int(SIZE / cells)
    return big[off : off + SIZE, off : off + SIZE]


def _fbm(rng, octaves) -> np.ndarray:
    return sum(amp * _noise(rng, cells) for cells, amp in octaves)


# ------------------------------------------------------------------ tear ----

def tear(mask: np.ndarray, rng: np.random.Generator, rim_max: float) -> tuple[np.ndarray, np.ndarray]:
    """Return (body, outer): the torn paper and the paper plus its pale rim."""
    if not mask.any():
        empty = np.zeros_like(mask, dtype=bool)
        return empty, empty
    f = ndimage.gaussian_filter(mask.astype(float), 2.5)
    # wobble the whole edge (mid frequency) and add a fine fibrous jag
    dx = _fbm(rng, [(9, 1.4 * PX), (24, 0.6 * PX), (60, 0.25 * PX)])
    dy = _fbm(rng, [(9, 1.4 * PX), (24, 0.6 * PX), (60, 0.25 * PX)])
    yy, xx = np.mgrid[0:SIZE, 0:SIZE].astype(float)
    warped = ndimage.map_coordinates(f, [yy + dy, xx + dx], order=1, mode="constant")
    jag = _fbm(rng, [(70, 0.13), (150, 0.08)])
    body = warped > 0.5 + jag

    # the rim shows on some stretches of the edge and not others, like a real
    # rip where the top layer peeled away on one side only
    dist = ndimage.distance_transform_edt(~body)
    width = np.clip(_fbm(rng, [(6, 1.0), (16, 0.4)]) * 1.6 + 0.2, 0, 1) * rim_max * PX
    fibres = _fbm(rng, [(60, 0.5), (130, 0.45), (220, 0.3)]) * PX * 0.9
    outer = body | (dist < width + fibres)
    outer = ndimage.binary_opening(outer, iterations=1) | body
    return body, outer


# -------------------------------------------------------------- vectorise ---

def _rdp(pts: np.ndarray, eps: float) -> np.ndarray:
    if len(pts) < 3:
        return pts
    start, end = pts[0], pts[-1]
    seg = end - start
    norm = math.hypot(*seg)
    if norm == 0:
        d = np.hypot(*(pts - start).T)
    else:
        d = np.abs(seg[0] * (pts[:, 1] - start[1]) - seg[1] * (pts[:, 0] - start[0])) / norm
    i = int(np.argmax(d))
    if d[i] > eps:
        left = _rdp(pts[: i + 1], eps)
        right = _rdp(pts[i:], eps)
        return np.vstack([left[:-1], right])
    return np.vstack([start, end])


def to_path(mask: np.ndarray, eps: float = 0.7) -> str:
    if not mask.any():
        return ""
    field = ndimage.gaussian_filter(mask.astype(float), 0.8)
    lines = contourpy.contour_generator(z=field, line_type="Separate").lines(0.5)
    parts = []
    for ln in lines:
        if len(ln) < 6:
            continue
        # split closed rings so RDP keeps both halves
        mid = len(ln) // 2
        pts = np.vstack([_rdp(ln[: mid + 1], eps)[:-1], _rdp(ln[mid:], eps)])
        units = pts / PX - PAD
        coords = " ".join(f"{x:.2f} {y:.2f}" for x, y in units)
        parts.append(f"M{coords}Z")
    return "".join(parts)


# ---------------------------------------------------------------- render ----

def seed_for(word: str) -> int:
    return int(hashlib.sha256(word.encode()).hexdigest()[:8], 16)


def build_geometry(word: str, eps: float = 0.7, glyph: dict | None = None) -> dict:
    """`glyph` overrides the GLYPHS lookup, for shapes that aren't words."""
    rng = np.random.default_rng(seed_for(word))
    base, dark = rasterise(glyph if glyph is not None else GLYPHS[word])
    body, outer = tear(base, rng, rim_max=3.0)
    dbody, douter = tear(dark, rng, rim_max=1.8)
    return {
        "body": to_path(body, eps),
        "outer": to_path(outer, eps),
        "dark_body": to_path(dbody, eps),
        "dark_outer": to_path(douter, eps),
        "tilt": round(float(rng.uniform(-7, 7)), 1),
        "tex_offset": [round(float(v), 1) for v in rng.uniform(0, TEXTURE_UNITS, 2)],
        "tex_rotate": round(float(rng.choice([0, 90, 180, 270]) + rng.uniform(-10, 10)), 1),
    }


def render_svg(word: str, geo: dict, tex: dict) -> str:
    i = f"smp-{word}"
    t = TEXTURE_UNITS
    ox, oy = geo["tex_offset"]
    pattern_tf = f'translate({ox} {oy}) rotate({geo["tex_rotate"]})'
    lo, hi = -PAD, 100 + 2 * PAD
    dark = ""
    if geo["dark_body"]:
        dark = (
            f'<path d="{geo["dark_outer"]}" fill="{tex["rim"]}" opacity="0.9"/>'
            f'<path d="{geo["dark_body"]}" fill="url(#{i}-d)"/>'
        )
    dark_pattern = ""
    if geo["dark_body"]:
        dark_pattern = (
            f'<pattern id="{i}-d" patternUnits="userSpaceOnUse" width="{t}" height="{t}" '
            f'patternTransform="{pattern_tf} translate(17 29)">'
            f'<image href="{tex["dark_uri"]}" width="{t}" height="{t}"/></pattern>'
        )
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{lo} {lo} {hi} {hi}" '
        f'role="img" aria-label="{word}">'
        f"<title>{word}</title>"
        "<defs>"
        f'<pattern id="{i}-l" patternUnits="userSpaceOnUse" width="{t}" height="{t}" '
        f'patternTransform="{pattern_tf}">'
        f'<image href="{tex["light_uri"]}" width="{t}" height="{t}"/></pattern>'
        f"{dark_pattern}"
        f'<filter id="{i}-s" x="-10%" y="-10%" width="120%" height="120%">'
        '<feGaussianBlur stdDeviation="1.1"/></filter>'
        "</defs>"
        f'<g transform="rotate({geo["tilt"]} 50 50)">'
        # glued-down shadow, offset toward the bottom right
        f'<path d="{geo["outer"]}{geo["dark_outer"]}" fill="#2B1238" opacity="0.28" '
        f'transform="translate(1.1 1.6)" filter="url(#{i}-s)"/>'
        f'<path d="{geo["outer"]}" fill="{tex["rim"]}"/>'
        f'<path d="{geo["body"]}" fill="url(#{i}-l)"/>'
        f"{dark}"
        "</g></svg>"
    )


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("words", nargs="*")
    ap.add_argument("--colourway", action="append")
    ap.add_argument("--out", type=Path, default=OUT)
    args = ap.parse_args()

    words = args.words or sorted(GLYPHS)
    unknown = [w for w in words if w not in GLYPHS]
    if unknown:
        raise SystemExit(f"no glyph defined for: {', '.join(unknown)}")

    ways = colourways()
    names = args.colourway or ["violet"]
    textures = {}
    for name in names:
        cw = ways[name]
        # small tile keeps each standalone SVG light
        def uri(rgb):
            small = Image.fromarray(np.clip(rgb, 0, 255).astype(np.uint8)).resize((256, 256), Image.LANCZOS)
            return to_data_uri(np.asarray(small), quality=68)
        textures[name] = {"light_uri": uri(cw["light"]), "dark_uri": uri(cw["dark"]), "rim": cw["rim"]}

    # a partial run updates the existing manifest rather than replacing it
    manifest_path = args.out / "manifest.json"
    manifest = json.loads(manifest_path.read_text()) if manifest_path.exists() else {}
    for word in words:
        geo = build_geometry(word)
        manifest[word] = {
            "layers": ["light"] + (["dark"] if geo["dark_body"] else []),
            "tilt": geo["tilt"],
        }
        for name in names:
            d = args.out / name
            d.mkdir(parents=True, exist_ok=True)
            (d / f"{word}.svg").write_text(render_svg(word, geo, textures[name]))
        print(f"{word:>16}  tilt {geo['tilt']:+5.1f}  {len(geo['body']) // 1024} KB path")

    manifest_path.write_text(json.dumps(dict(sorted(manifest.items())), indent=2) + "\n")


if __name__ == "__main__":
    main()
