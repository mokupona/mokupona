# sitelen moku pona generator

Builds the torn violet-paper toki pona glyphs in [`sitelen-moku-pona/`](../../sitelen-moku-pona/) — one SVG per core word (the 131 words nimi.li lists as "core").

Needs Python 3 with numpy, scipy, Pillow and contourpy (ships with matplotlib).

```bash
cd scripts/sitelen
python3 generate.py            # every glyph → sitelen-moku-pona/violet/*.svg + manifest.json
python3 generate.py pona jan   # just these
python3 sheet.py --cols 12     # PNG contact sheet → sitelen-moku-pona/sheet-violet.png
python3 preview.py             # preview.html (open in a browser, hover to enlarge)
python3 textures.py            # rebuild the paper tiles from source/purple-paper.jpg
python3 web.py                 # landing-page sprite → public/sitelen/sprite.svg
python3 arcade.py              # /musi easter egg: sprite → app/features/musi/, pale paper → public/sitelen/
```

- `glyphs.py` — each glyph's structure on a 0..100 grid: `base` strokes (light paper), `fill` for half-closed shapes (fully closed ones fill automatically), `dark` lines glued on top, `dots`. Drawn fresh, following the structure on nimi.li rather than any font's outlines.
- `generate.py` — rasterise → fill counters → tear edges with noise → pale torn rim → trace to SVG paths, filled with the paper texture. Seeded by the word, so output is reproducible.
- `textures.py` — seamless paper tiles from the photo; `--colourway photo|plum` are still defined if we ever want them.
- `arcade.py` — the `/musi` whack-a-soweli page: torn numerals 0–9 and a colon (`DIGITS` in `glyphs.py`, kept out of `GLYPHS` so they never show up as words), the torn hole, and a pale colourway of the paper for the machine.
