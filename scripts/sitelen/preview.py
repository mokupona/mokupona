"""Write sitelen-moku-pona/preview.html: every generated glyph per colourway on
the site's paper background, with the hover enlarge for a feel of the effect."""

from __future__ import annotations

import json
from pathlib import Path

OUT = Path(__file__).resolve().parents[2] / "sitelen-moku-pona"


def main() -> None:
    manifest = json.loads((OUT / "manifest.json").read_text())
    ways = sorted(p.name for p in OUT.iterdir() if p.is_dir() and p.name != "textures")
    sections = []
    for way in ways:
        cells = "".join(
            f'<figure><img src="{way}/{w}.svg" alt="{w}"><figcaption>{w}</figcaption></figure>'
            for w in manifest
        )
        sections.append(f"<section><h2>{way}</h2><div class=grid>{cells}</div></section>")
    (OUT / "preview.html").write_text(f"""<!doctype html>
<meta charset=utf-8><title>sitelen moku pona — preview</title>
<style>
  body {{ margin: 0; padding: 24px 32px; background: #F7FAE7; color: #4A4466; font: 300 14px/1.4 system-ui, sans-serif; }}
  h1 {{ font-weight: 300; margin: 0 0 8px; }}
  h2 {{ font-weight: 400; margin: 28px 0 4px; text-transform: uppercase; letter-spacing: .12em; font-size: 12px; }}
  .grid {{ display: grid; grid-template-columns: repeat(auto-fill, minmax(118px, 1fr)); gap: 4px 10px; }}
  figure {{ margin: 0; text-align: center; }}
  img {{ width: 112px; height: 112px; transition: transform .35s cubic-bezier(.3,1.6,.5,1); }}
  img:hover {{ transform: scale(1.6); position: relative; z-index: 1; }}
  figcaption {{ font-size: 11px; opacity: .7; margin-top: -6px; }}
</style>
<h1>sitelen moku pona</h1>
<p>Hover a glyph to enlarge it. One section per paper colourway.</p>
{''.join(sections)}
""")


if __name__ == "__main__":
    main()
