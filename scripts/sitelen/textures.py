"""Paper textures for sitelen moku pona.

Turns the crinkled-paper photo into a seamless, evenly lit tile, then derives
colourways from it. Each colourway has a light tone (the paper cut-out) and a
dark tone (the thick lines glued on top of complex glyphs).
"""

from __future__ import annotations

import io
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

HERE = Path(__file__).parent
SOURCE = HERE / "source" / "purple-paper.jpg"
TILE = 384


def _hex(h: str) -> np.ndarray:
    h = h.lstrip("#")
    return np.array([int(h[i : i + 2], 16) for i in (0, 2, 4)], dtype=float)


def _seamless(img: np.ndarray) -> np.ndarray:
    """Make the tile wrap without seams.

    One axis at a time: cross-fade with a copy rolled half a tile along that
    axis, keeping the original in the middle (where the rolled copy has its
    seam) and the rolled copy at the edges (where the original has its seam).
    Doing both axes at once leaves a seam cross through the middle.
    """
    for axis in (0, 1):
        n = img.shape[axis]
        rolled = np.roll(img, n // 2, axis=axis)
        d = np.minimum(np.arange(n), n - 1 - np.arange(n)) / (n / 2)
        w = np.clip(d * 2.2, 0, 1) ** 1.5
        shape = [1] * img.ndim
        shape[axis] = n
        w = w.reshape(shape)
        img = img * w + rolled * (1 - w)
    return img


def luminance_tile() -> np.ndarray:
    """Evenly lit crinkle luminance in 0..1, seamless."""
    im = Image.open(SOURCE).convert("RGB")
    # top-right crop avoids the dark corner of the table in the photo
    w, h = im.size
    side = min(w, h) - 90
    im = im.crop((w - side, 0, w, side)).resize((TILE, TILE), Image.LANCZOS)
    a = np.asarray(im, dtype=float)
    lum = a @ np.array([0.299, 0.587, 0.114])
    # flatten the photo's lighting gradient, keep the crinkles
    lum = lum - ndimage.gaussian_filter(lum, 40, mode="wrap") + lum.mean()
    lum = _seamless(lum)
    lo, hi = np.percentile(lum, [1, 99])
    return np.clip((lum - lo) / (hi - lo), 0, 1)


def photo_tile() -> np.ndarray:
    """The original photo colours, evenly lit and seamless."""
    im = Image.open(SOURCE).convert("RGB")
    w, h = im.size
    side = min(w, h) - 90
    im = im.crop((w - side, 0, w, side)).resize((TILE, TILE), Image.LANCZOS)
    a = np.asarray(im, dtype=float)
    a = a - ndimage.gaussian_filter(a, (40, 40, 0), mode="wrap") + a.mean((0, 1))
    return np.clip(_seamless(a), 0, 255)


def ramp(lum: np.ndarray, shadow: str, mid: str, light: str) -> np.ndarray:
    s, m, l = _hex(shadow), _hex(mid), _hex(light)
    t = lum[..., None]
    lower = s + (m - s) * (t / 0.5)
    upper = m + (l - m) * ((t - 0.5) / 0.5)
    return np.where(t < 0.5, lower, upper)


# name -> (light tone, dark tone, torn-edge colour)
def colourways() -> dict[str, dict[str, object]]:
    lum = luminance_tile()
    photo = photo_tile()
    return {
        # the paper as photographed — pink-magenta
        "photo": {
            "light": photo,
            "dark": photo * np.array([0.62, 0.52, 0.66]),
            "rim": "#FBEFF4",
        },
        # same crinkles, pulled toward the wordmark's crayon purple (#380888)
        "violet": {
            "light": ramp(lum, "#5A2C9E", "#8C62CF", "#C7AEEE"),
            "dark": ramp(lum, "#2A0A62", "#45198C", "#6E47B4"),
            "rim": "#F6F0FC",
        },
        # dusty plum, between the photo's pink and the site's muted ink
        "plum": {
            "light": ramp(lum, "#6A2F72", "#9A579A", "#CFA2CB"),
            "dark": ramp(lum, "#32123F", "#4F2160", "#77428A"),
            "rim": "#FAF1F6",
        },
    }


def to_data_uri(rgb: np.ndarray, quality: int = 72) -> str:
    import base64

    buf = io.BytesIO()
    Image.fromarray(np.clip(rgb, 0, 255).astype(np.uint8)).save(
        buf, "JPEG", quality=quality, optimize=True, progressive=True
    )
    return "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode()


def save_tiles(out: Path) -> None:
    out.mkdir(parents=True, exist_ok=True)
    for name, cw in colourways().items():
        for tone in ("light", "dark"):
            Image.fromarray(np.clip(cw[tone], 0, 255).astype(np.uint8)).save(
                out / f"paper-{name}-{tone}.jpg", quality=80, optimize=True
            )


if __name__ == "__main__":
    save_tiles(HERE.parent.parent / "sitelen-moku-pona" / "textures")
