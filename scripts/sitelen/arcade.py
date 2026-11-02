"""Web build for the /musi easter egg (the whack-a-soweli arcade).

    python3 scripts/sitelen/arcade.py

Writes public/sitelen/arcade.svg — torn-paper numerals 0-9 and a colon for the
countdown clock, plus the torn hole the soweli pop out of — and
public/sitelen/paper-pale.jpg, the same crinkles as the violet paper but
near-white, for the machine's playfield and backboard. Like the violet tiles
it is drawn in the original cool hue; the page warms all of it with the
art-warm utility, so it lands on the site's blush paper.

The soweli, the ilo hammer and the backboard stickers come from the landing
page sprite (web.py); this sprite only holds what that one doesn't. Like that
sprite, the symbols point at page-level patterns (#smp-paper-l0..3) and the
--smp-rim / --smp-shadow / --smp-hole custom properties.
"""

from __future__ import annotations

from pathlib import Path

import generate as g
from glyphs import DIGITS, arc
from textures import luminance_tile, ramp
from web import LIGHT_VARIANTS, _short, save_texture

OUT = g.ROOT / "public" / "sitelen"

# a wide, shallow oval: the hole seen at the playfield's tilt
HOLE = {"base": [arc(50, 50, 44, 17)]}


def numeral(name: str, index: int) -> str:
    geo = g.build_geometry(f"digit-{name}", eps=1.6, glyph=DIGITS[name])
    outer, body = _short(geo["outer"]), _short(geo["body"])
    # the counters are real holes, so the paths need even-odd filling
    return (
        f'<symbol id="smp-digit-{name}" viewBox="-8 -8 116 116">'
        # numerals sit straighter than the words: a third of the word tilt
        f'<g transform="rotate({round(geo["tilt"] / 3, 1)} 50 50)" fill-rule="evenodd">'
        f'<path d="{outer}" fill="var(--smp-shadow)" transform="translate(1.2 1.8)"/>'
        f'<path d="{outer}" fill="var(--smp-rim)"/>'
        f'<path d="{body}" fill="url(#smp-paper-l{index % LIGHT_VARIANTS})"/>'
        "</g></symbol>"
    )


def hole() -> str:
    geo = g.build_geometry("lupa-arcade", eps=1.6, glyph=HOLE)
    outer, body = _short(geo["outer"]), _short(geo["body"])
    # the pale torn rim belongs to the playfield paper; inside is the dark
    return (
        '<symbol id="smp-hole" viewBox="-8 -8 116 116">'
        f'<path d="{outer}" fill="var(--smp-rim)"/>'
        f'<path d="{body}" fill="var(--smp-hole)"/>'
        "</symbol>"
    )


def save_pale(path: Path) -> None:
    lum = luminance_tile()
    save_texture(ramp(lum, "#D3CDDD", "#E9E5F0", "#FAF8FD"), path)


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    symbols = "".join(numeral(n, i) for i, n in enumerate(DIGITS)) + hole()
    (OUT / "arcade.svg").write_text(f'<svg xmlns="http://www.w3.org/2000/svg">{symbols}</svg>\n')
    save_pale(OUT / "paper-pale.jpg")
    for name in ("arcade.svg", "paper-pale.jpg"):
        print(f"{name:>18}  {(OUT / name).stat().st_size // 1024} KB")


if __name__ == "__main__":
    main()
