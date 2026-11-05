import { encode } from "uqr";

/** A QR code drawn on a grid of one unit per module. */
export interface QrCode {
  /** modules per side, the quiet zone included */
  size: number;
  /** SVG path data covering every dark module */
  path: string;
}

// the quiet zone the QR spec asks for, so scanners find the code even when
// it's printed right up against other artwork
const QUIET_ZONE = 4;

/**
 * Encodes `text` with medium error correction, which survives a smudged or
 * partly covered print and still keeps a short URL at a small version.
 */
export function createQrCode(text: string): QrCode {
  const { size, data } = encode(text, { ecc: "M", border: QUIET_ZONE });

  // each run of dark modules in a row becomes one rectangle, which keeps the
  // path (and the downloaded file) a fraction of a path per module
  let path = "";
  data.forEach((row, y) => {
    let x = 0;
    while (x < size) {
      if (!row[x]) {
        x++;
        continue;
      }
      const start = x;
      while (x < size && row[x]) x++;
      path += `M${start} ${y}h${x - start}v1H${start}z`;
    }
  });

  return { size, path };
}

/**
 * A standalone SVG file of the code: black on white, so it prints and scans
 * the same whatever the page around it looks like.
 */
export function qrCodeSvg(
  { size, path }: QrCode,
  { pixelsPerModule = 10 }: { pixelsPerModule?: number } = {},
) {
  const pixels = size * pixelsPerModule;

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${pixels}" height="${pixels}" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges">`,
    `<rect width="${size}" height="${size}" fill="#fff"/>`,
    `<path d="${path}" fill="#000"/>`,
    `</svg>`,
  ].join("");
}

export function qrCodeSvgDataUrl(qr: QrCode) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(qrCodeSvg(qr))}`;
}

/** The PNG is at least this many pixels wide, enough for an A4 poster. */
const PNG_MIN_PIXELS = 1200;

/**
 * Draws the code onto a canvas and encodes it as a PNG. Browser only. Each
 * module is a whole number of pixels, so the edges stay sharp.
 */
export function qrCodePng({ size, path }: QrCode): Promise<Blob> {
  const scale = Math.ceil(PNG_MIN_PIXELS / size);
  const canvas = document.createElement("canvas");
  canvas.width = size * scale;
  canvas.height = size * scale;

  const context = canvas.getContext("2d");
  if (!context) {
    return Promise.reject(new Error("Canvas 2D context is unavailable"));
  }

  context.fillStyle = "#fff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.scale(scale, scale);
  context.fillStyle = "#000";
  context.fill(new Path2D(path));

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Canvas could not be encoded as a PNG"));
    }, "image/png");
  });
}

/**
 * A file name (without extension) for an event's QR code: the title as a
 * slug, so a folder of downloaded codes stays readable.
 */
export function qrCodeFileName(title: string) {
  const slug = title
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .slice(0, 60)
    .replace(/^-+|-+$/g, "");

  return `${slug || "event"}-qr-code`;
}
