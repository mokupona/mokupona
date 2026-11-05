import { CopyIcon, DownloadIcon, LinkIcon } from "lucide-react";
import { useMemo } from "react";
import { toast } from "sonner";

import {
  createQrCode,
  qrCodeFileName,
  qrCodePng,
  qrCodeSvgDataUrl,
} from "../qr-code";

import { Button, buttonVariants } from "~/components/ui/button";
import { Card } from "~/components/ui/card";

/**
 * The QR code of an event's public page, for flyers, posters and chats:
 * copy it as an image, download it as a PNG or SVG, or copy the link.
 */
export function AdminEventQrCode({
  url,
  title,
}: {
  /** the absolute URL of the public event page */
  url: string;
  title: string;
}) {
  const qr = useMemo(() => createQrCode(url), [url]);
  const fileName = qrCodeFileName(title);

  async function copyImage() {
    if (
      typeof ClipboardItem === "undefined" ||
      typeof navigator.clipboard?.write !== "function"
    ) {
      toast.error("This browser can't copy images. Download the PNG instead.");
      return;
    }

    try {
      // Safari only keeps the click's permission when the item gets the
      // pending PNG straight away, so the promise goes in unawaited
      await navigator.clipboard.write([
        new ClipboardItem({ "image/png": qrCodePng(qr) }),
      ]);
      toast.success("QR code copied");
    } catch {
      toast.error("Couldn't copy the QR code. Download it instead.");
    }
  }

  async function downloadPng() {
    try {
      saveBlob(await qrCodePng(qr), `${fileName}.png`);
    } catch {
      toast.error("Couldn't create the PNG. Try the SVG instead.");
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied");
    } catch {
      toast.error("Couldn't copy the link.");
    }
  }

  return (
    <Card
      as="section"
      aria-labelledby="event-qr-code-heading"
      className="flex flex-col gap-4 rounded-lg p-4 sm:flex-row sm:items-center"
    >
      <svg
        role="img"
        aria-label={`QR code linking to ${url}`}
        viewBox={`0 0 ${qr.size} ${qr.size}`}
        shapeRendering="crispEdges"
        className="size-36 shrink-0 self-center rounded-md sm:self-auto"
      >
        <rect width={qr.size} height={qr.size} fill="#fff" />
        <path d={qr.path} fill="#000" />
      </svg>

      <div className="flex min-w-0 flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h2
            id="event-qr-code-heading"
            className="text-sm leading-none font-semibold"
          >
            QR code
          </h2>
          <p className="text-muted-foreground text-sm">
            Scanning it opens the public event page:{" "}
            <a
              href={url}
              className="text-primary break-all underline-offset-4 hover:underline"
            >
              {url}
            </a>
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={copyImage}>
            <CopyIcon aria-hidden className="size-4" />
            Copy image
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={downloadPng}
          >
            <DownloadIcon aria-hidden className="size-4" />
            Download PNG
          </Button>
          <a
            href={qrCodeSvgDataUrl(qr)}
            download={`${fileName}.svg`}
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            <DownloadIcon aria-hidden className="size-4" />
            Download SVG
          </a>
          <Button type="button" variant="ghost" size="sm" onClick={copyLink}>
            <LinkIcon aria-hidden className="size-4" />
            Copy link
          </Button>
        </div>
      </div>
    </Card>
  );
}

function saveBlob(blob: Blob, fileName: string) {
  const href = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = href;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  // the click has handed the file to the browser by the next task
  setTimeout(() => URL.revokeObjectURL(href));
}
