import { encode } from "uqr";
import { describe, expect, it } from "vitest";

import {
  createQrCode,
  qrCodeFileName,
  qrCodeSvg,
  qrCodeSvgDataUrl,
} from "./qr-code";

const url = "https://mokupona.ch/events/cm9x2k3ab0001qz8f7h6y5t4r";

/** Reads the path back into a module grid, the way a renderer fills it. */
function paintPath(size: number, path: string) {
  const grid = Array.from({ length: size }, () =>
    Array<boolean>(size).fill(false),
  );
  for (const [, x, y, width] of path.matchAll(/M(\d+) (\d+)h(\d+)v1H\1z/g)) {
    for (let dx = 0; dx < Number(width); dx++) {
      grid[Number(y)][Number(x) + dx] = true;
    }
  }
  return grid;
}

describe("createQrCode", () => {
  it("draws exactly the modules of the encoded matrix", () => {
    const { size, path } = createQrCode(url);
    const { data } = encode(url, { ecc: "M", border: 4 });

    expect(size).toBe(data.length);
    // nothing but run rectangles: anything else would be dropped by paintPath
    expect(path.replace(/M(\d+) (\d+)h(\d+)v1H\1z/g, "")).toBe("");
    expect(paintPath(size, path)).toEqual(data);
  });

  it("keeps a four-module quiet zone on every side", () => {
    const { size, path } = createQrCode(url);
    const grid = paintPath(size, path);
    const edge = [0, 1, 2, 3, size - 4, size - 3, size - 2, size - 1];

    for (const i of edge) {
      expect(grid[i].some(Boolean)).toBe(false);
      expect(grid.some((row) => row[i])).toBe(false);
    }
  });
});

describe("qrCodeSvg", () => {
  it("is a standalone black-on-white SVG sized from the module count", () => {
    const qr = createQrCode(url);
    const svg = qrCodeSvg(qr, { pixelsPerModule: 8 });

    expect(svg).toMatch(/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
    expect(svg).toContain(`viewBox="0 0 ${qr.size} ${qr.size}"`);
    expect(svg).toContain(`width="${qr.size * 8}"`);
    expect(svg).toContain(
      `<rect width="${qr.size}" height="${qr.size}" fill="#fff"/>`,
    );
    expect(svg).toContain(`<path d="${qr.path}" fill="#000"/>`);
  });

  it("encodes into a data URL that decodes back to the same file", () => {
    const qr = createQrCode(url);
    const dataUrl = qrCodeSvgDataUrl(qr);
    const prefix = "data:image/svg+xml;charset=utf-8,";

    expect(dataUrl.startsWith(prefix)).toBe(true);
    expect(decodeURIComponent(dataUrl.slice(prefix.length))).toBe(
      qrCodeSvg(qr),
    );
  });
});

describe("qrCodeFileName", () => {
  it.each([
    ["Summer Dinner 2026", "summer-dinner-2026-qr-code"],
    ["  Crème brûlée & Rösti!  ", "creme-brulee-rosti-qr-code"],
    ["moku pona: toki pona", "moku-pona-toki-pona-qr-code"],
    ["🍜🍣", "event-qr-code"],
    ["", "event-qr-code"],
  ])("turns %j into %j", (title, fileName) => {
    expect(qrCodeFileName(title)).toBe(fileName);
  });

  it("caps long titles without a trailing dash", () => {
    const fileName = qrCodeFileName(`${"a".repeat(59)} b c d e f`);

    expect(fileName).toBe(`${"a".repeat(59)}-qr-code`);
  });
});
