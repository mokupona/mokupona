"""Give the hand-drawn artwork real transparency.

The wordmark, logo and handwritten headings in public/ are SVG wrappers
around scanned JPEGs: dark ink on a white box. They used to rely on
`mix-blend-mode: multiply` to drop the white, but Safari won't blend against
a separately composited layer (like the landing page's fixed glyph backdrop),
so the white box showed.

This swaps every embedded JPEG for a WebP whose white is alpha ("colour to
alpha" against white, as in GIMP): over white paper it looks identical, and
over anything else the ink just sits on top. Idempotent — files with no JPEG
left are skipped.

    python3 scripts/artwork/transparent.py            # the default files
    python3 scripts/artwork/transparent.py public/x.svg
"""

import base64
import io
import re
import sys
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
DEFAULT = [
    "public/naive-title.svg",
    "public/naive-logo.svg",
    "public/our_vision.svg",
    "public/next_dinner.svg",
    "public/past_dinners.svg",
]
JPEG = re.compile(r"data:image/jpeg;base64,([A-Za-z0-9+/=\s]+)")
# scan/JPEG noise: anything this light is paper, not ink
WHITE_POINT = 235
QUALITY = 82


def colour_to_alpha(jpeg: bytes) -> bytes:
    rgb = np.asarray(Image.open(io.BytesIO(jpeg)).convert("RGB"), dtype=np.float64)
    # stretch so near-white becomes pure white (and so fully transparent)
    rgb = np.clip(rgb * 255.0 / WHITE_POINT, 0, 255)
    distance = (255.0 - rgb) / 255.0  # per channel, how far from white
    alpha = distance.max(axis=2)
    safe = np.where(alpha > 0, alpha, 1)[..., None]
    colour = 255.0 - (255.0 - rgb) / safe  # un-mix the white back out
    rgba = np.dstack([colour, alpha * 255.0])
    out = io.BytesIO()
    # lossy WebP keeps alpha at about JPEG sizes (PNG roughly doubles them);
    # every browser we support decodes it, Safari since 14
    Image.fromarray(np.round(rgba).astype(np.uint8), "RGBA").save(
        out, "WEBP", quality=QUALITY, method=6
    )
    return out.getvalue()


def convert(path: Path) -> None:
    text = path.read_text()
    count = 0

    def swap(match: re.Match) -> str:
        nonlocal count
        count += 1
        png = colour_to_alpha(base64.b64decode(match.group(1)))
        return "data:image/webp;base64," + base64.b64encode(png).decode()

    new = JPEG.sub(swap, text)
    if not count:
        print(f"{path.relative_to(ROOT)}: no JPEG, skipped")
        return
    path.write_text(new)
    print(f"{path.relative_to(ROOT)}: {count} image(s), {len(text):,} → {len(new):,} bytes")


if __name__ == "__main__":
    for name in sys.argv[1:] or DEFAULT:
        convert(ROOT / name)
