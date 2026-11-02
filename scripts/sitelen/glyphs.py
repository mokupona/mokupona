"""Glyph structure for sitelen moku pona.

Drawn fresh for this script on a 0..100 grid (y points down). The shapes follow
the structure of the standard sitelen pona glyphs listed on nimi.li, not any
particular font's outlines.

Each glyph has up to four kinds of parts:

  base  — strokes cut from the light paper
  fill  — closed or half-closed areas filled solid with the light paper
          (fully enclosed counters are filled automatically; list half-closed
          shapes such as a U here)
  dark  — thick lines cut from the darker paper and glued on top, for the
          inner structure of complex glyphs that the fill would otherwise hide
  dots  — round dots, as (x, y, r, layer) with layer "base" or "dark"
"""

from __future__ import annotations

import math

Point = tuple[float, float]


def line(*pts: Point) -> list[Point]:
    return list(pts)


def arc(cx: float, cy: float, rx: float, ry: float | None = None, a0: float = 0, a1: float = 360, n: int = 72) -> list[Point]:
    """Elliptical arc. Angles in degrees, 0 = right, 90 = down."""
    ry = rx if ry is None else ry
    steps = max(4, int(n * abs(a1 - a0) / 360))
    return [
        (cx + rx * math.cos(math.radians(a0 + (a1 - a0) * i / steps)),
         cy + ry * math.sin(math.radians(a0 + (a1 - a0) * i / steps)))
        for i in range(steps + 1)
    ]


def bez(p0: Point, p1: Point, p2: Point, p3: Point, n: int = 32) -> list[Point]:
    out = []
    for i in range(n + 1):
        t = i / n
        u = 1 - t
        out.append((
            u**3 * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t**3 * p3[0],
            u**3 * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t**3 * p3[1],
        ))
    return out


def quad(p0: Point, p1: Point, p2: Point, n: int = 32) -> list[Point]:
    return bez(p0, (p0[0] + 2 / 3 * (p1[0] - p0[0]), p0[1] + 2 / 3 * (p1[1] - p0[1])),
               (p2[0] + 2 / 3 * (p1[0] - p2[0]), p2[1] + 2 / 3 * (p1[1] - p2[1])), p2, n)


def closed(pts: list[Point]) -> list[Point]:
    """Close an open stroke back to its start, making a solid outline."""
    return pts + [pts[0]]


def chain(*parts: list[Point]) -> list[Point]:
    out: list[Point] = []
    for p in parts:
        out.extend(p if not out else p[1:])
    return out


def wave(x0: float, x1: float, y: float, amp: float, periods: float = 1, n: int = 64) -> list[Point]:
    return [(x0 + (x1 - x0) * i / n, y - amp * math.sin(2 * math.pi * periods * i / n)) for i in range(n + 1)]


def vwave(y0: float, y1: float, x: float, amp: float, periods: float = 1, n: int = 64) -> list[Point]:
    return [(x + amp * math.sin(2 * math.pi * periods * i / n), y0 + (y1 - y0) * i / n) for i in range(n + 1)]


def rect(x0: float, y0: float, x1: float, y1: float) -> list[Point]:
    return [(x0, y0), (x1, y0), (x1, y1), (x0, y1), (x0, y0)]


def u(x0: float, x1: float, top: float, bottom: float) -> list[Point]:
    """A U: straight sides from `top` down into a round bottom."""
    r = (x1 - x0) / 2
    cy = bottom - r
    return chain(line((x0, top), (x0, cy)), arc(x0 + r, cy, r, r, 180, 0), line((x1, cy), (x1, top)))


def arch(x0: float, x1: float, top: float, bottom: float) -> list[Point]:
    """An ∩: round top, straight sides down to `bottom`."""
    r = (x1 - x0) / 2
    cy = top + r
    return chain(line((x0, bottom), (x0, cy)), arc(x0 + r, cy, r, r, 180, 360), line((x1, cy), (x1, bottom)))


def heart(cx: float, cy: float, w: float) -> list[Point]:
    k = w / 72
    tpl = chain(
        bez((50, 36), (40, 16), (10, 22), (14, 46)),
        bez((14, 46), (18, 64), (42, 74), (50, 88)),
        bez((50, 88), (58, 74), (82, 64), (86, 46)),
        bez((86, 46), (90, 22), (60, 16), (50, 36)),
    )
    return [(cx + (x - 50) * k, cy + (y - 56) * k) for x, y in tpl]


def rays(cx: float = 50, top: float = 10, length: float = 15, spread: float = 27) -> list[list[Point]]:
    """Three short rays fanning upward (sound, light, speech)."""
    return [
        line((cx, top), (cx, top + length)),
        line((cx - spread, top + 9), (cx - spread + 9, top + 9 + length * 0.9)),
        line((cx + spread, top + 9), (cx + spread - 9, top + 9 + length * 0.9)),
    ]


def spiral(cx: float, cy: float, r0: float, r1: float, turns: float, n: int = 220) -> list[Point]:
    pts = []
    for i in range(n + 1):
        t = i / n
        r = r0 + (r1 - r0) * t
        a = 2 * math.pi * turns * t
        pts.append((cx + r * math.cos(a), cy + r * math.sin(a)))
    return pts


def x_mark(cx: float, cy: float, s: float) -> list[list[Point]]:
    return [line((cx - s, cy - s), (cx + s, cy + s)), line((cx + s, cy - s), (cx - s, cy + s))]


def flower(cx: float, cy: float, r: float, wob: float, lobes: int, n: int = 120) -> list[Point]:
    return [
        (cx + (r + wob * math.sin(lobes * 2 * math.pi * i / n)) * math.cos(2 * math.pi * i / n),
         cy + (r + wob * math.sin(lobes * 2 * math.pi * i / n)) * math.sin(2 * math.pi * i / n))
        for i in range(n + 1)
    ]


GLYPHS: dict[str, dict] = {
    "pona": {
        # traced as a closed outline (bowl + rim) so the rim is flat, no horns at the tips
        "base": [closed(arc(50, 34, 36, 40, 8, 172))],
        "fill": [arc(50, 34, 36, 40, 8, 172)],
    },
    "jan": {
        "base": [arc(50, 38, 24), line((33, 55), (20, 84)), line((67, 55), (80, 84))],
    },
    "moku": {
        "base": [
            line((22, 14), (78, 14)),
            bez((24, 14), (24, 42), (72, 52), (74, 86)),
            bez((76, 14), (76, 42), (32, 50), (32, 80)),
            line((32, 80), (20, 70)),
        ],
    },
    "soweli": {
        "base": [
            chain(line((18, 22), (66, 22)), bez((66, 22), (92, 22), (92, 62), (66, 62)), line((66, 62), (18, 62))),
            line((22, 70), (22, 86)), line((36, 70), (36, 86)), line((50, 70), (50, 86)), line((64, 70), (62, 84)),
        ],
        "fill": [chain(line((18, 22), (66, 22)), bez((66, 22), (92, 22), (92, 62), (66, 62)), line((66, 62), (18, 62)))],
        "dots": [(56, 38, 5, "dark"), (72, 38, 5, "dark")],
    },
    "lukin": {
        "base": [quad((10, 50), (50, 14), (90, 50)), quad((10, 50), (50, 86), (90, 50))],
        "dots": [(50, 50, 9, "dark")],
    },
    "tomo": {
        "base": [line((18, 88), (18, 42), (50, 14), (82, 42), (82, 88), (18, 88))],
    },
    "sike": {
        "base": [arc(50, 50, 38)],
        "dark": [arc(50, 50, 15)],
    },
    "kili": {
        "base": [
            chain(
                bez((50, 36), (32, 22), (10, 36), (15, 60)),
                bez((15, 60), (20, 86), (42, 92), (50, 85)),
                bez((50, 85), (58, 92), (80, 86), (85, 60)),
                bez((85, 60), (90, 36), (68, 22), (50, 36)),
            ),
            bez((50, 36), (49, 24), (55, 15), (64, 9)),
        ],
    },
    "telo": {
        "base": [wave(12, 88, 34, 9), wave(12, 88, 66, 9)],
    },
    "kala": {
        "base": [
            chain(bez((34, 50), (48, 24), (90, 22), (89, 50)), bez((89, 50), (88, 78), (48, 76), (34, 50))),
            line((34, 50), (13, 29)),
            line((34, 50), (13, 71)),
        ],
    },
    "suno": {
        "base": [arc(50, 50, 18), line((50, 8), (50, 28)), line((50, 72), (50, 92)),
                 line((8, 50), (28, 50)), line((72, 50), (92, 50))],
    },
    "akesi": {
        "base": [arc(50, 54, 17, 30)],
        "dark": [line((20, 38), (80, 38)), line((18, 54), (82, 54)), line((20, 70), (80, 70))],
        "dots": [(34, 12, 5.5, "base"), (66, 12, 5.5, "base")],
    },

    # ---------------------------------------------------------- a – k ----
    "a": {
        "base": [line((42, 8), (42, 62)), arc(48, 77, 11), line((58, 82), (66, 90))],
    },
    "ala": {"base": x_mark(50, 50, 34)},
    "alasa": {
        "base": [chain(line((34, 18), (34, 78)), bez((34, 78), (74, 78), (74, 18), (34, 18)))],
        "dark": [line((8, 48), (88, 48)), line((74, 34), (88, 48), (74, 62))],
    },
    "ale": {"base": [arc(30, 50, 18), arc(70, 50, 18)]},
    "anpa": {"base": [line((14, 20), (14, 36), (86, 36), (86, 20))], "dots": [(50, 66, 7, "base")]},
    "ante": {"base": [line((12, 20), (50, 40), (88, 20)), line((12, 80), (50, 60), (88, 80))]},
    "anu": {"base": [line((18, 12), (50, 50), (82, 12)), line((50, 50), (50, 90))]},
    "awen": {"base": [line((8, 84), (26, 84), (50, 16), (74, 84), (92, 84))]},
    "e": {"base": [line((16, 16), (44, 50), (16, 84)), line((50, 16), (78, 50), (50, 84))]},
    "en": {"base": [line((12, 50), (88, 50)), line((50, 12), (50, 88))]},
    "esun": {
        "base": [
            bez((12, 26), (34, 50), (60, 62), (88, 82)),
            chain(bez((14, 84), (36, 60), (50, 50), (60, 42)), arc(70, 28, 16, 16, 130, 490)),
        ],
    },
    "ijo": {"base": [arc(50, 50, 36)]},
    "ike": {"base": [arch(14, 86, 26, 64)], "fill": [arch(14, 86, 26, 64)]},
    "ilo": {
        "base": [rect(22, 12, 78, 50), line((50, 50), (50, 90))],
        "dark": [line((50, 18), (50, 46)), line((27, 31), (73, 31))],
    },
    "insa": {"base": [line((14, 28), (14, 64), (86, 64), (86, 28))], "fill": [rect(14, 40, 86, 64)],
             "dots": [(50, 48, 7, "dark")]},
    "jaki": {
        "base": [arc(40, 40, 22), arc(60, 60, 22), line((24, 78), (12, 88))],
        "dark": [wave(26, 74, 50, 8, 1.5)],
    },
    "jelo": {
        "base": [arc(50, 28, 9), line((50, 6), (50, 18)), line((24, 28), (40, 28)), line((60, 28), (76, 28)),
                 line((50, 38), (50, 46)), line((50, 46), (26, 84), (74, 84), (50, 46))],
    },
    "jo": {
        "base": [arc(60, 26, 12), chain(arc(46, 60, 32, 30, 285, 0), line((78, 60), (58, 60)))],
    },
    "kalama": {
        "base": [line((22, 56), (78, 56)), arc(50, 56, 28, 28, 0, 180)] + rays(50, 12, 16, 26),
        "fill": [arc(50, 56, 28, 28, 0, 180)],
    },
    "kama": {"base": [line((6, 84), (22, 84), (48, 16), (76, 84))]},
    "kasi": {
        "base": [
            line((50, 44), (50, 90)),
            chain(quad((50, 44), (20, 46), (12, 16)), quad((12, 16), (44, 14), (50, 44))),
            chain(quad((50, 44), (80, 46), (88, 16)), quad((88, 16), (56, 14), (50, 44))),
        ],
    },
    "ken": {
        "base": [line((24, 10), (24, 90)), line((24, 52), (74, 12)),
                 bez((24, 52), (62, 52), (78, 64), (78, 90))],
    },
    "kepeken": {
        "base": [rect(30, 10, 70, 40), line((50, 40), (50, 60)), line((22, 60), (78, 60)),
                 line((30, 60), (22, 88)), line((70, 60), (78, 88))],
        "dark": [line((50, 16), (50, 34))],
    },
    "kiwen": {"base": [line((24, 18), (76, 18), (92, 40), (50, 88), (8, 40), (24, 18))]},
    "ko": {"base": [flower(50, 50, 30, 8, 5)]},
    "kon": {"base": [vwave(10, 90, 26, 7), vwave(10, 90, 50, 7), vwave(10, 90, 74, 7)]},
    "kule": {
        "base": [line((50, 16), (86, 80), (14, 80), (50, 16))],
        "dark": [line((8, 56), (92, 56))],
    },
    "kulupu": {"base": [arc(50, 26, 15), arc(26, 70, 15), arc(74, 70, 15)]},
    "kute": {
        "base": [chain(bez((24, 32), (28, 4), (80, 6), (72, 40)), bez((72, 40), (64, 62), (40, 64), (32, 92))),
                 line((40, 42), (50, 58))],
    },
    # ---------------------------------------------------------- l – n ----
    "la": {"base": [bez((34, 10), (72, 28), (72, 72), (34, 90))]},
    "lape": {"base": [line((8, 50), (52, 50)), arc(70, 50, 16)]},
    "laso": {
        "base": [
            chain(quad((50, 44), (20, 44), (12, 14)), quad((12, 14), (44, 12), (50, 44))),
            chain(quad((50, 44), (80, 44), (88, 14)), quad((88, 14), (56, 12), (50, 44))),
            line((50, 44), (24, 88), (76, 88), (50, 44)),
        ],
    },
    "lawa": {"base": [arc(50, 56, 30)], "dark": [line((8, 46), (92, 46))]},
    "len": {
        "base": [rect(14, 14, 86, 48), line((14, 48), (14, 88)), line((86, 48), (86, 88)),
                 line((38, 48), (38, 88)), line((62, 48), (62, 88))],
    },
    "lete": {"base": [line((10, 50), (90, 50)), line((28, 16), (72, 84)), line((72, 16), (28, 84))]},
    "li": {"base": [line((30, 14), (72, 50), (30, 86))]},
    "lili": {"base": [line((34, 40), (50, 60), (66, 40))]},
    "linja": {"base": [wave(10, 90, 50, 11)]},
    "lipu": {"base": [rect(18, 14, 82, 86)]},
    "loje": {"base": [line((20, 12), (80, 12), (20, 88), (80, 88), (20, 12))]},
    "lon": {"base": [line((10, 64), (90, 64))], "dots": [(50, 38, 7.5, "base")]},
    "luka": {
        "base": [chain(line((12, 58), (24, 84), (34, 66)), arch(34, 80, 18, 88))],
        "fill": [arch(34, 80, 18, 88)],
    },
    "lupa": {"base": [closed(u(20, 80, 10, 88))], "fill": [u(20, 80, 10, 88)]},
    "ma": {"base": [arc(50, 50, 36)], "dark": [line((14, 50), (86, 50)), line((50, 14), (50, 86))]},
    "mama": {"base": [arc(50, 40, 30), line((50, 70), (50, 74)), arc(50, 82, 9)]},
    "mani": {
        "base": [arc(50, 62, 27), bez((30, 42), (18, 34), (16, 18), (26, 8)),
                 bez((70, 42), (82, 34), (84, 18), (74, 8))],
    },
    "meli": {"base": [arch(14, 86, 12, 88)], "fill": [arch(14, 86, 12, 88)], "dark": [arc(50, 58, 17)]},
    "mi": {
        "base": [chain(bez((44, 88), (34, 64), (34, 40), (38, 30)), arc(54, 30, 16, 16, 180, 490))],
    },
    "mije": {
        "base": [arc(50, 40, 28), line((26, 56), (24, 86), (12, 86)), line((74, 56), (76, 86), (88, 86))],
    },
    "misikeke": {
        "base": [chain(line((32, 30), (32, 70)), arc(50, 70, 18, 18, 180, 0), line((68, 70), (68, 30)),
                       arc(50, 30, 18, 18, 0, -180))],
        "dark": [line((32, 50), (68, 50))],
    },
    "moli": {"base": [arc(50, 50, 36)], "dark": x_mark(36, 50, 8) + x_mark(64, 50, 8)},
    "monsi": {"base": [line((80, 16), (58, 16), (58, 84), (80, 84))], "fill": [rect(58, 16, 80, 84)],
              "dots": [(24, 40, 7.5, "base")]},
    "monsuta": {
        "base": [line((8, 54), (18, 36), (28, 60), (40, 26), (52, 62), (62, 32), (72, 58), (82, 38), (92, 52))],
    },
    "mu": {
        "base": [arc(50, 58, 27), arc(24, 28, 12), arc(76, 28, 12)],
        "dots": [(40, 54, 4.5, "dark"), (60, 54, 4.5, "dark"), (50, 68, 4.5, "dark")],
    },
    "mun": {"base": [chain(arc(54, 50, 36, 36, 60, 300), arc(66, 50, 26, 30, 255, 105))],
            "fill": [chain(arc(54, 50, 36, 36, 60, 300), arc(66, 50, 26, 30, 255, 105))]},
    "musi": {"base": [u(26, 74, 26, 86), arc(26, 18, 10), arc(74, 18, 10)], "fill": [u(26, 74, 44, 86)]},
    "mute": {"base": [line((26, 12), (26, 88)), line((50, 12), (50, 88)), line((74, 12), (74, 88))]},
    "n": {"base": [line((50, 8), (50, 36)), arch(34, 66, 58, 90)], "fill": [arch(34, 66, 58, 90)]},
    "namako": {
        "base": [line((50, 10), (52, 34)), line((48, 66), (50, 90)), line((10, 52), (34, 48)), line((66, 52), (90, 48))],
    },
    "nanpa": {"base": [line((36, 10), (36, 90)), line((64, 10), (64, 90)),
                       line((10, 36), (90, 36)), line((10, 64), (90, 64))]},
    "nasa": {"base": [spiral(50, 50, 3, 36, 2.3)]},
    "nasin": {"base": [line((50, 12), (50, 90)), line((20, 60), (50, 38), (80, 60))]},
    "nena": {"base": [arch(18, 82, 14, 88)], "fill": [arch(18, 82, 14, 88)]},
    "ni": {"base": [line((50, 10), (50, 86)), line((28, 62), (50, 88), (72, 62))]},
    "nimi": {"base": [rect(12, 30, 88, 70)]},
    "noka": {"base": [line((24, 10), (24, 86), (80, 86), (80, 58), (52, 58))], "fill": [rect(24, 58, 80, 86)]},
    # ---------------------------------------------------------- o – s ----
    "o": {"base": [line((50, 10), (50, 58)), arc(50, 80, 9)]},
    "olin": {"base": [heart(50, 68, 54)] + rays(50, 4, 12, 26)},
    "ona": {"base": [line((10, 62), (54, 62)), arc(68, 50, 16)]},
    "open": {"base": [line((16, 12), (16, 86), (84, 86), (84, 12)), line((16, 60), (84, 60))]},
    "pakala": {
        "base": [rect(14, 14, 86, 86)],
        "dark": [line((62, 22), (36, 48), (64, 54), (40, 80))],
    },
    "pali": {
        "base": [arc(52, 30, 18), line((64, 44), (70, 90)), line((40, 44), (24, 70), (36, 84))],
    },
    "palisa": {"base": [chain(line((40, 22), (40, 78)), arc(50, 78, 10, 10, 180, 0), line((60, 78), (60, 22)),
                              arc(50, 22, 10, 10, 0, -180))]},
    "pan": {"base": [line((20, 16), (50, 34), (80, 16)), line((20, 40), (50, 58), (80, 40)),
                     line((20, 64), (50, 82), (80, 64))]},
    "pana": {"base": [arch(30, 70, 56, 90)] + rays(50, 12, 16, 30), "fill": [arch(30, 70, 56, 90)]},
    "pi": {"base": [line((24, 10), (24, 86), (86, 86))]},
    "pilin": {"base": [heart(50, 50, 80)]},
    "pimeja": {
        "base": [line((50, 12), (90, 86), (10, 86), (50, 12))],
        "dark": [line((32, 58), (58, 86)), line((68, 58), (42, 86))],
    },
    "pini": {"base": [line((26, 14), (74, 14)), line((26, 86), (74, 86)), line((50, 14), (50, 86))]},
    "pipi": {"base": [line((50, 8), (50, 92)), line((22, 30), (78, 30)), line((22, 50), (78, 50)),
                      line((22, 70), (78, 70))], "dots": [(36, 12, 5, "base"), (64, 12, 5, "base")]},
    "poka": {"base": [line((12, 36), (12, 64), (60, 64), (60, 36))], "fill": [rect(12, 46, 60, 64)],
             "dots": [(80, 50, 7.5, "base")]},
    "poki": {"base": [line((16, 12), (16, 86), (84, 86), (84, 12))], "fill": [rect(16, 34, 84, 86)]},
    "pu": {
        "base": [rect(18, 10, 82, 90)],
        "dark": [arc(50, 62, 11)] + rays(50, 22, 12, 18),
    },
    "sama": {"base": [line((12, 36), (88, 36)), line((12, 64), (88, 64))]},
    "seli": {"base": [line((50, 10), (50, 56)), line((26, 14), (38, 54)), line((74, 14), (62, 54))],
             "dots": [(50, 80, 8, "base")]},
    "selo": {"base": [line((14, 24), (86, 24)), line((14, 24), (14, 82)), line((40, 24), (40, 68)),
                      line((64, 24), (64, 68)), line((86, 24), (86, 82))]},
    "seme": {"base": [chain(arc(50, 32, 22, 20, 190, 360), bez((72, 32), (72, 50), (50, 48), (50, 64)))],
             "dots": [(50, 84, 7.5, "base")]},
    "sewi": {"base": [line((12, 62), (20, 86), (84, 86)), line((38, 86), (38, 58)), line((60, 86), (60, 36)),
                      line((84, 86), (84, 12))]},
    "sijelo": {
        "base": [line((10, 16), (90, 16)), rect(22, 16, 78, 86)],
        "dark": [line((40, 22), (40, 70)), line((60, 22), (60, 70))],
    },
    "sin": {"base": [line((10, 60), (36, 60)), line((64, 60), (90, 60)), line((50, 30), (50, 50))]},
    "sina": {"base": [arc(48, 66, 20), bez((30, 62), (26, 36), (40, 16), (60, 12))]},
    "sinpin": {"base": [line((20, 16), (42, 16), (42, 84), (20, 84))], "fill": [rect(20, 16, 42, 84)],
               "dots": [(74, 50, 7.5, "base")]},
    "sitelen": {
        "base": [rect(14, 16, 86, 84)],
        "dots": [(32, 50, 5.5, "dark"), (50, 50, 5.5, "dark"), (68, 50, 5.5, "dark")],
    },
    "soko": {"base": [chain(arc(50, 48, 36, 32, 180, 360), line((86, 48), (14, 48))), line((50, 48), (50, 90))]},
    "sona": {"base": [rect(26, 46, 74, 86)] + rays(50, 10, 16, 28)},
    "suli": {"base": [line((14, 12), (50, 88), (86, 12))]},
    "supa": {"base": [line((10, 32), (90, 32)), line((30, 32), (30, 82)), line((70, 32), (70, 82))]},
    "suwi": {"base": [line((10, 44), (26, 26), (42, 44)), line((58, 44), (74, 26), (90, 44))],
             "dots": [(50, 66, 6, "base")]},
    # ---------------------------------------------------------- t – w ----
    "tan": {"base": [arc(52, 58, 32, 30, 0, -180), line((8, 44), (20, 62), (34, 46))]},
    "taso": {"base": [line((66, 10), (66, 90)), line((12, 50), (66, 50))]},
    "tawa": {"base": [line((14, 84), (42, 16), (70, 84), (92, 84))]},
    "tenpo": {"base": [arc(50, 50, 36)], "dark": [line((50, 26), (50, 52), (70, 52))]},
    "toki": {"base": [arc(50, 64, 22)] + rays(50, 8, 16, 30)},
    "tonsi": {"base": [arc(50, 46, 18), bez((34, 36), (24, 30), (18, 22), (12, 10)),
                       bez((66, 36), (76, 30), (82, 22), (88, 10)), line((50, 64), (50, 90))]},
    "tu": {"base": [line((38, 12), (38, 88)), line((62, 12), (62, 88))]},
    "unpa": {"base": [arc(32, 32, 16), arc(68, 32, 16), arc(50, 68, 13, 21)]},
    "uta": {"base": [line((14, 22), (86, 22)), arc(50, 22, 36, 36, 0, 180)], "fill": [arc(50, 22, 36, 36, 0, 180)],
            "dots": [(50, 84, 7.5, "base")]},
    "utala": {"base": [bez((14, 14), (36, 40), (64, 60), (82, 84)), bez((86, 14), (64, 40), (36, 60), (18, 84)),
                       line((82, 84), (92, 74)), line((18, 84), (8, 74))]},
    "walo": {"base": [line((50, 14), (86, 82), (14, 82), (50, 14)), line((32, 46), (14, 34)), line((68, 46), (86, 34))]},
    "wan": {"base": [line((32, 30), (56, 12), (56, 88))]},
    "waso": {"base": [line((30, 10), (80, 60), (42, 66), (40, 90))],
             "dots": [(30, 40, 5.5, "base"), (46, 46, 5.5, "base")]},
    "wawa": {"base": [line((14, 14), (28, 72)), line((86, 14), (72, 72)),
                      chain(bez((50, 36), (34, 54), (36, 82), (50, 82)), bez((50, 82), (64, 82), (66, 54), (50, 36)))]},
    "weka": {"base": [line((12, 12), (32, 32)), line((88, 12), (68, 32)), line((12, 88), (32, 68)),
                      line((88, 88), (68, 68))]},
    "wile": {
        "base": [chain(line((12, 20), (12, 64)), arc(31, 64, 19, 19, 180, 0), arc(69, 64, 19, 19, 180, 0),
                       line((88, 64), (88, 20)))],
        "fill": [arc(31, 64, 19, 19, 180, 0), arc(69, 64, 19, 19, 180, 0)],
    },
    # ---------------------------------------------------- ku suli core ----
    "kijetesantakalu": {
        "base": [
            chain(line((40, 74), (40, 42)), bez((40, 42), (40, 24), (74, 22), (82, 40)),
                  line((82, 40), (94, 54), (80, 60)), bez((80, 60), (78, 72), (70, 74), (40, 74))),
            line((60, 30), (56, 16), (66, 26)),
            rect(8, 54, 40, 74),
            line((52, 74), (52, 88)), line((72, 74), (72, 88)),
        ],
        "dark": [line((18, 56), (18, 72)), line((28, 56), (28, 72))],
        "dots": [(66, 44, 4.5, "dark"), (78, 46, 4, "dark")],
    },
    "kin": {"base": [line((50, 8), (50, 40))] + [line((50, 56), (50, 90)), line((34, 64), (66, 82)),
                                                    line((66, 64), (34, 82))]},
    "kipisi": {"base": [line((14, 86), (86, 14))], "dots": [(22, 24, 9, "base"), (78, 76, 9, "base")]},
    "ku": {
        "base": [rect(16, 10, 84, 90)],
        "dark": [line((32, 30), (68, 22), (60, 62), (32, 30))],
        "dots": [(56, 74, 5, "dark")],
    },
    "leko": {"base": [rect(12, 12, 88, 88)], "dark": [rect(34, 34, 66, 66)]},
}


# ------------------------------------------------------------ numerals ----
# Not toki pona: plain hand-cut numerals for the easter-egg arcade clock
# (scripts/sitelen/arcade.py). Kept apart from GLYPHS so generate.py's
# "every glyph" run doesn't pick them up. Their counters stay open.

DIGITS: dict[str, dict] = {
    "0": {"base": [arc(50, 50, 24, 36)]},
    "1": {"base": [line((34, 28), (54, 12), (54, 88)), line((36, 88), (72, 88))]},
    "2": {"base": [chain(arc(50, 34, 24, 22, 200, 380), line((72.6, 41.5), (26, 88), (76, 88)))]},
    "3": {"base": [arc(47, 31, 22, 18, -160, 90), arc(47, 67, 26, 21, -90, 160)]},
    "4": {"base": [line((62, 88), (62, 12), (22, 64), (80, 64))]},
    "5": {"base": [line((72, 12), (34, 12), (29, 47)), arc(48, 64, 26, 24, -140, 150)]},
    "6": {"base": [arc(50, 64, 24, 24), bez((26, 64), (24, 36), (40, 14), (66, 12))]},
    "7": {"base": [line((22, 12), (78, 12), (42, 88))]},
    "8": {"base": [arc(50, 30, 19, 18), arc(50, 68, 24, 20)]},
    "9": {"base": [arc(50, 36, 24, 24), bez((74, 36), (76, 64), (62, 86), (34, 88))]},
    "colon": {"base": [], "dots": [(50, 32, 7, "base"), (50, 70, 7, "base")]},
}
for _d in DIGITS.values():
    _d["keep_counters"] = True
