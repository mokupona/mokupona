"""moku pona logo variants: two glyphs torn from one sheet of paper.

    python3 logo.py          # → sitelen-moku-pona/logo/*.svg and logo-sheet.png

Layouts: side by side, and stacked (the usual sitelen pona way of writing two
words as one sign — each glyph squashed to half height, one above the other).
"""

from __future__ import annotations

import math

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

import generate as g
import sheet
from glyphs import GLYPHS, arc
from textures import colourways

OUT = g.OUT / "logo"
CANVAS = 200  # units; room for two glyphs side by side


def place(glyph: dict, sx: float, sy: float, dx: float, dy: float, rot: float = 0) -> dict:
    """Scale about the glyph centre, rotate, then shift — strokes keep their width."""
    c, s_ = math.cos(math.radians(rot)), math.sin(math.radians(rot))

    def tf(p):
        x, y = (p[0] - 50) * sx, (p[1] - 50) * sy
        return (x * c - y * s_ + 50 + dx, x * s_ + y * c + 50 + dy)

    out = {k: [[tf(p) for p in pts] for pts in glyph.get(k, [])] for k in ("base", "fill", "dark")}
    out["dots"] = [(*tf((x, y)), r * math.sqrt(sx * sy) if sy < 1 else r, layer) for x, y, r, layer in glyph.get("dots", [])]
    return out


def merge(*glyphs: dict) -> dict:
    return {k: [item for gl in glyphs for item in gl.get(k, [])] for k in ("base", "fill", "dark", "dots")}


def layouts() -> dict[str, dict]:
    out = {}
    for second in ("pona", "lupa"):
        # pona is squeezed narrower so it doesn't outweigh moku
        squeeze = 0.74 if second == "pona" else 1
        out[f"moku-{second}"] = merge(
            place(GLYPHS["moku"], 1, 1, 0, 0, -3),
            place(GLYPHS[second], squeeze, 1, 92 - (1 - squeeze) * 40 - 14, 0, 3),
        )
        out[f"moku-{second}-stacked"] = merge(
            place(GLYPHS["moku"], 1, 0.6, 0, -20, -2),
            place(GLYPHS[second], 1, 0.6, 0, 26 if second == "pona" else 34, 2),
        )
    # comparison: pona as just its curved stroke, not the filled bowl
    pona_line = {"base": [arc(50, 34, 36, 40, 8, 172)]}
    out["moku-pona-line"] = merge(
        place(GLYPHS["moku"], 1, 1, 0, 0, -3),
        place(pona_line, 0.74, 1, 92 - 0.26 * 40 - 14, 0, 3),
    )
    return out


def build(name: str, glyph: dict) -> dict:
    rng = np.random.default_rng(g.seed_for("logo-" + name))
    base, dark = g.rasterise(glyph)
    body, outer = g.tear(base, rng, rim_max=3.0)
    dbody, douter = g.tear(dark, rng, rim_max=1.8)
    return {"body": body, "outer": outer, "dbody": dbody, "douter": douter,
            "offset": rng.uniform(0, g.TEXTURE_UNITS, 2)}


def svg(name: str, m: dict, tex: dict) -> str:
    ys, xs = np.nonzero(m["outer"])
    m_ = 4  # units of breathing room for the shadow
    x0, y0 = xs.min() / g.PX - g.PAD - m_, ys.min() / g.PX - g.PAD - m_
    w, h = (xs.max() - xs.min()) / g.PX + 2 * m_, (ys.max() - ys.min()) / g.PX + 2 * m_
    i, t = f"smp-logo-{name}", g.TEXTURE_UNITS
    ox, oy = (round(float(v), 1) for v in m["offset"])
    paths = {k: g.to_path(m[k]) for k in ("body", "outer", "dbody", "douter")}
    dark = ""
    if paths["dbody"]:
        dark = (f'<path d="{paths["douter"]}" fill="{tex["rim"]}" opacity="0.9"/>'
                f'<path d="{paths["dbody"]}" fill="url(#{i}-d)"/>')
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{x0:.1f} {y0:.1f} {w:.1f} {h:.1f}" role="img" '
        f'aria-label="moku pona"><title>moku pona</title><defs>'
        f'<pattern id="{i}-l" patternUnits="userSpaceOnUse" width="{t}" height="{t}" patternTransform="translate({ox} {oy})">'
        f'<image href="{tex["light_uri"]}" width="{t}" height="{t}"/></pattern>'
        f'<pattern id="{i}-d" patternUnits="userSpaceOnUse" width="{t}" height="{t}" patternTransform="translate({oy} {ox})">'
        f'<image href="{tex["dark_uri"]}" width="{t}" height="{t}"/></pattern>'
        f'<filter id="{i}-s" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="1.1"/></filter>'
        f'</defs>'
        f'<path d="{paths["outer"]}{paths["douter"]}" fill="#2B1238" opacity="0.28" transform="translate(1.1 1.6)" filter="url(#{i}-s)"/>'
        f'<path d="{paths["outer"]}" fill="{tex["rim"]}"/>'
        f'<path d="{paths["body"]}" fill="url(#{i}-l)"/>{dark}</svg>'
    )


def png(m: dict, cw: dict, bg=sheet.PAPER) -> Image.Image:
    img = np.broadcast_to(np.asarray(bg, float), (g.SIZE, g.SIZE, 3)).copy()
    sh = ndimage.shift((m["outer"] | m["douter"]).astype(float), (1.6 * g.PX, 1.1 * g.PX), order=0)
    sh = ndimage.gaussian_filter(sh, 1.1 * g.PX) * 0.28
    img = img * (1 - sh[..., None]) + sheet._hex("#2B1238") * sh[..., None]
    for mask, colour in ((m["outer"], sheet._hex(cw["rim"])), (m["body"], sheet._tiled(cw["light"], m["offset"])),
                         (m["douter"], sheet._hex(cw["rim"])), (m["dbody"], sheet._tiled(cw["dark"], m["offset"] + 23))):
        a = ndimage.gaussian_filter(mask.astype(float), 0.7)[..., None]
        img = img * (1 - a) + colour * a
    ys, xs = np.nonzero(m["outer"])
    pad = 4 * g.PX
    crop = img[max(0, ys.min() - pad): ys.max() + pad, max(0, xs.min() - pad): xs.max() + pad]
    return Image.fromarray(np.clip(crop, 0, 255).astype(np.uint8))


def main() -> None:
    g.SIZE = (CANVAS + 2 * g.PAD) * g.PX
    cw = colourways()["violet"]

    def uri(rgb):
        small = Image.fromarray(np.clip(rgb, 0, 255).astype(np.uint8)).resize((256, 256), Image.LANCZOS)
        from textures import to_data_uri
        return to_data_uri(np.asarray(small), quality=72)

    tex = {"light_uri": uri(cw["light"]), "dark_uri": uri(cw["dark"]), "rim": cw["rim"]}
    OUT.mkdir(parents=True, exist_ok=True)
    tiles = []
    for name, glyph in layouts().items():
        m = build(name, glyph)
        (OUT / f"{name}.svg").write_text(svg(name, m, tex))
        im = png(m, cw)
        im.save(OUT / f"{name}.png")
        png(m, cw, bg=(255, 255, 255)).save(OUT / f"{name}-white.png")
        tiles.append((name, im))
        print(name, im.size)

    # side-by-side comparison sheet, every logo at the same height
    hgt = 360
    scaled = [(n, im.resize((round(im.width * hgt / im.height), hgt), Image.LANCZOS)) for n, im in tiles]
    W = sum(im.width for _, im in scaled) + 60 * (len(scaled) + 1)
    out = Image.new("RGB", (W, hgt + 90), tuple(int(c) for c in sheet.PAPER))
    x = 60
    d = ImageDraw.Draw(out)
    for n, im in scaled:
        out.paste(im, (x, 30))
        d.text((x, hgt + 50), n, fill=(74, 68, 102))
        x += im.width + 60
    out.save(OUT / "logo-sheet.png")


if __name__ == "__main__":
    main()
