import { encode } from "uqr";

// the nav's mark, already turned by --art-hue-shift (scripts/artwork/qr-logo.py)
// and inlined, so a downloaded SVG carries it without pointing at the site
import qrLogoDataUrl from "./qr-logo.png?inline";

/** The logo's native size, which the box it is drawn into keeps. */
const LOGO_ASPECT = 360 / 301;

/** A QR code drawn on a grid of one unit per module. */
export interface QrCode {
  /** modules per side, the quiet zone included */
  size: number;
  /** SVG path data covering every dark module */
  path: string;
  /** where the logo goes, in modules; null for a plain code */
  logo: QrLogo | null;
}

/** The logo's box, centred in the square the code leaves white for it. */
export interface QrLogo {
  /** the cleared square: its top-left module and its side, in modules */
  area: { x: number; y: number; size: number };
  /** the logo itself, kept to its own aspect inside the area */
  x: number;
  y: number;
  width: number;
  height: number;
  href: string;
}

// the quiet zone the QR spec asks for, so scanners find the code even when
// it's printed right up against other artwork
const QUIET_ZONE = 4;

/**
 * How much of the symbol's width the logo may clear. With error correction
 * H (30% recoverable) a square this size costs about a tenth of the modules,
 * half of which were light anyway, so the code keeps a wide margin for
 * smudges and a bent poster.
 */
const LOGO_SHARE = 0.3;

/** Room left between the logo and the modules around it, in modules. */
const LOGO_PADDING = 0.5;

/**
 * Encodes `text` as a QR code. A plain code uses medium error correction,
 * which survives a smudged or partly covered print and still keeps a short
 * URL at a small version. With `logo`, the code switches to the highest
 * level and leaves a square in the middle white for the moku pona mark.
 */
export function createQrCode(
  text: string,
  { logo = false }: { logo?: boolean } = {},
): QrCode {
  const { size, data } = encode(text, {
    ecc: logo ? "H" : "M",
    border: QUIET_ZONE,
  });

  const area = logo ? logoArea(size) : null;
  const covered = (x: number, y: number) =>
    area !== null &&
    x >= area.x &&
    x < area.x + area.size &&
    y >= area.y &&
    y < area.y + area.size;

  // each run of dark modules in a row becomes one rectangle, which keeps the
  // path (and the downloaded file) a fraction of a path per module
  let path = "";
  data.forEach((row, y) => {
    let x = 0;
    while (x < size) {
      if (!row[x] || covered(x, y)) {
        x++;
        continue;
      }
      const start = x;
      while (x < size && row[x] && !covered(x, y)) x++;
      path += `M${start} ${y}h${x - start}v1H${start}z`;
    }
  });

  return { size, path, logo: area ? placeLogo(area) : null };
}

/**
 * The centred square the logo clears. Its side is odd, like every QR
 * symbol's, so it sits exactly on the middle module and the finder patterns
 * in the corners stay whole.
 */
function logoArea(size: number) {
  const symbol = size - 2 * QUIET_ZONE;
  let side = Math.floor(symbol * LOGO_SHARE);
  if (side % 2 === 0) side += 1;
  const start = (size - side) / 2;
  return { x: start, y: start, size: side };
}

function placeLogo(area: QrLogo["area"]): QrLogo {
  const box = area.size - 2 * LOGO_PADDING;
  // the mark is wider than tall, so the width fills the box
  const width = LOGO_ASPECT >= 1 ? box : box * LOGO_ASPECT;
  const height = width / LOGO_ASPECT;

  return {
    area,
    x: area.x + (area.size - width) / 2,
    y: area.y + (area.size - height) / 2,
    width,
    height,
    href: qrLogoDataUrl,
  };
}

/**
 * A standalone SVG file of the code: black on white, so it prints and scans
 * the same whatever the page around it looks like. The logo travels inside
 * the file, so it opens the same in a browser, a print shop or a layout app.
 */
export function qrCodeSvg(
  { size, path, logo }: QrCode,
  { pixelsPerModule = 10 }: { pixelsPerModule?: number } = {},
) {
  const pixels = size * pixelsPerModule;

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${pixels}" height="${pixels}" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges">`,
    `<rect width="${size}" height="${size}" fill="#fff"/>`,
    `<path d="${path}" fill="#000"/>`,
    logo
      ? // xlink:href rather than href: older layout and print tools still
        // only read the SVG 1.1 attribute, and every browser reads both
        `<image x="${logo.x}" y="${logo.y}" width="${logo.width}" height="${logo.height}" xlink:href="${logo.href}"/>`
      : "",
    `</svg>`,
  ].join("");
}

export function qrCodeSvgDataUrl(qr: QrCode) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(qrCodeSvg(qr))}`;
}

/** The PNG is at least this many pixels wide, enough for an A4 poster. */
const PNG_MIN_PIXELS = 1200;

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("The QR logo could not be loaded"));
    image.src = src;
  });
}

/**
 * Draws the code onto a canvas and encodes it as a PNG. Browser only. Each
 * module is a whole number of pixels, so the edges stay sharp.
 */
export async function qrCodePng({ size, path, logo }: QrCode): Promise<Blob> {
  const scale = Math.ceil(PNG_MIN_PIXELS / size);
  const canvas = document.createElement("canvas");
  canvas.width = size * scale;
  canvas.height = size * scale;

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Canvas 2D context is unavailable");
  }

  context.fillStyle = "#fff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.scale(scale, scale);
  context.fillStyle = "#000";
  context.fill(new Path2D(path));

  if (logo) {
    // a data URL, so the canvas stays untainted and can still be exported
    const image = await loadImage(logo.href);
    context.imageSmoothingQuality = "high";
    context.drawImage(image, logo.x, logo.y, logo.width, logo.height);
  }

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
