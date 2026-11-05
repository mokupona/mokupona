"""Cut the nav logo out for the middle of the event QR codes.

public/naive-logo.svg is a clipped, scaled window onto a larger scan (see
transparent.py), and the site shows it through the `art-warm` utility, which
turns it by --art-hue-shift. This bakes both into a small PNG, so the QR code
can carry the mark exactly as the nav shows it, in the downloaded SVG and PNG
files too, where no CSS applies.

The angle is read from app/tailwind.css: retune --art-hue-shift, run this
again, and the QR logo follows.

    python3 scripts/artwork/qr-logo.py
"""

import base64
import io
import math
import re
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "public/naive-logo.svg"
TAILWIND = ROOT / "app/tailwind.css"
TARGET = ROOT / "app/features/events/qr-logo.png"
# wide enough for the 1200px PNG download, where the logo spans ~300px
WIDTH = 360


def hue_shift_degrees() -> float:
    match = re.search(r"--art-hue-shift:\s*(-?[\d.]+)deg", TAILWIND.read_text())
    if not match:
        raise SystemExit("--art-hue-shift not found in app/tailwind.css")
    return float(match.group(1))


def hue_rotate(rgb: np.ndarray, degrees: float) -> np.ndarray:
    """The matrix of CSS `filter: hue-rotate()`, applied to sRGB values."""
    c = math.cos(math.radians(degrees))
    s = math.sin(math.radians(degrees))
    matrix = np.array(
        [
            [0.213 + c * 0.787 - s * 0.213, 0.715 - c * 0.715 - s * 0.715, 0.072 - c * 0.072 + s * 0.928],
            [0.213 - c * 0.213 + s * 0.143, 0.715 + c * 0.285 + s * 0.140, 0.072 - c * 0.072 - s * 0.283],
            [0.213 - c * 0.213 - s * 0.787, 0.715 - c * 0.715 + s * 0.715, 0.072 + c * 0.928 + s * 0.072],
        ]
    )
    return np.clip(rgb @ matrix.T, 0, 255)


def main() -> None:
    svg = SOURCE.read_text()

    view_box = [float(v) for v in re.search(r'viewBox="([^"]+)"', svg).group(1).split()]
    a, _, _, d, e, f = (
        float(v)
        for v in re.search(r'transform="matrix\(([^)]+)\)"', svg).group(1).split(",")
    )
    data = re.search(r"data:image/webp;base64,([A-Za-z0-9+/=]+)", svg).group(1)
    scan = Image.open(io.BytesIO(base64.b64decode(data))).convert("RGBA")

    # the viewBox in the scan's own pixels: invert the group's matrix
    _, _, view_w, view_h = view_box
    left, top = (0 - e) / a, (0 - f) / d
    right, bottom = (view_w - e) / a, (view_h - f) / d
    logo = scan.crop((round(left), round(top), round(right), round(bottom)))

    pixels = np.asarray(logo, dtype=np.float64)
    rgb = hue_rotate(pixels[..., :3], hue_shift_degrees())
    logo = Image.fromarray(
        np.dstack([rgb, pixels[..., 3]]).round().astype(np.uint8), "RGBA"
    )

    # trim the empty margin so the mark fills the space the QR code clears
    logo = logo.crop(logo.getchannel("A").point(lambda v: 255 if v > 8 else 0).getbbox())
    height = round(logo.height * WIDTH / logo.width)
    logo = logo.resize((WIDTH, height), Image.LANCZOS)

    # a 64-colour palette keeps the crayon texture at a fifth of the bytes;
    # the file is inlined into the admin bundle and every downloaded SVG
    logo = logo.quantize(colors=64, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.NONE)
    logo.save(TARGET, "PNG", optimize=True)
    print(f"{TARGET.relative_to(ROOT)}: {logo.width}x{logo.height}, {TARGET.stat().st_size} bytes")


if __name__ == "__main__":
    main()
