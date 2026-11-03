import type { FieldMetadata } from "@conform-to/react";
import { getInputProps, useFormMetadata } from "@conform-to/react";
import { ImageIcon, MinusIcon, PlusIcon } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState } from "react";

import { CoverImage } from "~/components/cover-image";
import { Field, fileFieldClassName } from "~/components/forms";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "~/components/ui/dialog";
import { Label } from "~/components/ui/label";
import type { ImageDisplaySource } from "~/shared/image";
import { VALID_IMAGE_TYPES } from "~/shared/image";

/**
 * Every place a cover appears (event page, next-event card, past-dinner
 * tiles) renders it at 3:2 with object-fit: cover, so cropping to exactly that
 * frame here is what makes the preview honest.
 */
const COVER_ASPECT = 3 / 2;
/** 2× the largest rendered width (1080px), enough for retina screens. */
const MAX_OUTPUT_WIDTH = 2160;
const MAX_OUTPUT_BYTES = 3 * 1024 * 1024;
const MIN_ZOOM = 1;
const MAX_ZOOM = 4;

type Offset = { x: number; y: number };

type Source = {
  file: File;
  url: string;
  width: number;
  height: number;
};

type CropState = { zoom: number; offset: Offset };

const INITIAL_CROP: CropState = { zoom: 1, offset: { x: 0, y: 0 } };

function loadImage(url: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not decode image"));
    img.src = url;
  });
}

/**
 * Geometry in frame-relative units: the frame is 1 wide and 1/ASPECT tall,
 * offsets are the image centre's distance from the frame centre in those same
 * units. Keeping everything relative means a resize of the dialog never
 * shifts the crop.
 */
function displayedSize(source: Source, zoom: number) {
  const frameH = 1 / COVER_ASPECT;
  const base = Math.max(1 / source.width, frameH / source.height);
  return {
    w: source.width * base * zoom,
    h: source.height * base * zoom,
    scale: base * zoom,
  };
}

function clampOffset(source: Source, zoom: number, offset: Offset): Offset {
  const { w, h } = displayedSize(source, zoom);
  const maxX = Math.max(0, (w - 1) / 2);
  const maxY = Math.max(0, (h - 1 / COVER_ASPECT) / 2);
  return {
    x: Math.min(maxX, Math.max(-maxX, offset.x)),
    y: Math.min(maxY, Math.max(-maxY, offset.y)),
  };
}

/** The crop rectangle in the source image's natural pixels. */
function sourceRect(source: Source, { zoom, offset }: CropState) {
  const { w, h, scale } = displayedSize(source, zoom);
  const frameH = 1 / COVER_ASPECT;
  const left = 0.5 + offset.x - w / 2;
  const top = frameH / 2 + offset.y - h / 2;
  return {
    sx: -left / scale,
    sy: -top / scale,
    sw: 1 / scale,
    sh: frameH / scale,
  };
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Export failed"))),
      "image/jpeg",
      quality,
    );
  });
}

async function renderCrop(source: Source, crop: CropState): Promise<File> {
  const img = await loadImage(source.url);
  const { sx, sy, sw, sh } = sourceRect(source, crop);
  const outW = Math.round(Math.min(MAX_OUTPUT_WIDTH, sw));
  const outH = Math.round(outW / COVER_ASPECT);

  const canvas = document.createElement("canvas");
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unsupported");
  // JPEG has no alpha; paint the paper colour under transparent PNGs.
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, outW, outH);
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, outW, outH);

  let blob = await canvasToBlob(canvas, 0.9);
  for (const quality of [0.8, 0.7, 0.6]) {
    if (blob.size <= MAX_OUTPUT_BYTES) break;
    blob = await canvasToBlob(canvas, quality);
  }

  const baseName = source.file.name.replace(/\.[^.]+$/, "") || "cover";
  return new File([blob], `${baseName}.jpg`, {
    type: "image/jpeg",
    lastModified: Date.now(),
  });
}

function setInputFile(input: HTMLInputElement, file: File | null) {
  const transfer = new DataTransfer();
  if (file) transfer.items.add(file);
  input.files = transfer.files;
}

function CoverCropper({
  source,
  crop,
  onChange,
}: {
  source: Source;
  crop: CropState;
  onChange: (crop: CropState) => void;
}) {
  const frameRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    origin: Offset;
  } | null>(null);
  const zoomId = useId();

  const { w, h } = displayedSize(source, crop.zoom);

  const update = (next: Partial<CropState>) => {
    const zoom = next.zoom ?? crop.zoom;
    onChange({
      zoom,
      offset: clampOffset(source, zoom, next.offset ?? crop.offset),
    });
  };

  function onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      origin: crop.offset,
    };
  }

  function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const state = drag.current;
    const frame = frameRef.current;
    if (!state || state.pointerId !== event.pointerId || !frame) return;
    const width = frame.getBoundingClientRect().width;
    update({
      offset: {
        x: state.origin.x + (event.clientX - state.startX) / width,
        y: state.origin.y + (event.clientY - state.startY) / width,
      },
    });
  }

  function onPointerUp(event: React.PointerEvent<HTMLDivElement>) {
    if (drag.current?.pointerId === event.pointerId) drag.current = null;
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    const step = event.shiftKey ? 0.05 : 0.01;
    const moves: Record<string, Offset> = {
      ArrowLeft: { x: step, y: 0 },
      ArrowRight: { x: -step, y: 0 },
      ArrowUp: { x: 0, y: step },
      ArrowDown: { x: 0, y: -step },
    };
    const move = moves[event.key];
    if (move) {
      event.preventDefault();
      update({
        offset: { x: crop.offset.x + move.x, y: crop.offset.y + move.y },
      });
    } else if (event.key === "+" || event.key === "=") {
      event.preventDefault();
      update({ zoom: Math.min(MAX_ZOOM, crop.zoom + 0.1) });
    } else if (event.key === "-") {
      event.preventDefault();
      update({ zoom: Math.max(MIN_ZOOM, crop.zoom - 0.1) });
    }
  }

  // Wheel zoom has to be a non-passive native listener to stop the dialog
  // from scrolling underneath.
  const cropRef = useRef(crop);
  cropRef.current = crop;
  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const current = cropRef.current;
      const zoom = Math.min(
        MAX_ZOOM,
        Math.max(MIN_ZOOM, current.zoom * Math.exp(-event.deltaY * 0.002)),
      );
      onChange({ zoom, offset: clampOffset(source, zoom, current.offset) });
    };
    frame.addEventListener("wheel", onWheel, { passive: false });
    return () => frame.removeEventListener("wheel", onWheel);
  }, [onChange, source]);

  return (
    <div className="flex flex-col gap-4">
      <div
        ref={frameRef}
        role="application"
        aria-label="Crop area. Drag or use the arrow keys to move the photo, plus and minus to zoom."
        tabIndex={0}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onKeyDown={onKeyDown}
        className="bg-muted focus-visible:ring-ring relative w-full cursor-grab touch-none overflow-hidden select-none focus-visible:ring-2 focus-visible:outline-hidden active:cursor-grabbing"
        style={{ aspectRatio: `${COVER_ASPECT}` }}
      >
        <img
          src={source.url}
          alt=""
          draggable={false}
          className="pointer-events-none absolute max-w-none"
          style={{
            width: `${w * 100}%`,
            left: `${(0.5 + crop.offset.x - w / 2) * 100}%`,
            // top is a percentage of the frame's height, which is 1/ASPECT
            // in our units.
            top: `${(0.5 + (crop.offset.y - h / 2) * COVER_ASPECT) * 100}%`,
          }}
        />
        {/* Rule-of-thirds guides. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 grid grid-cols-3 grid-rows-3"
        >
          {Array.from({ length: 9 }, (_, i) => (
            <div key={i} className="border-[0.5px] border-white/40" />
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Label htmlFor={zoomId} className="sr-only">
          Zoom
        </Label>
        <button
          type="button"
          aria-label="Zoom out"
          className="text-muted-foreground hover:text-foreground"
          onClick={() => update({ zoom: Math.max(MIN_ZOOM, crop.zoom - 0.25) })}
        >
          <MinusIcon className="size-4" />
        </button>
        <input
          id={zoomId}
          type="range"
          min={MIN_ZOOM}
          max={MAX_ZOOM}
          step={0.01}
          value={crop.zoom}
          onChange={(event) => update({ zoom: Number(event.target.value) })}
          className="accent-primary grow"
        />
        <button
          type="button"
          aria-label="Zoom in"
          className="text-muted-foreground hover:text-foreground"
          onClick={() => update({ zoom: Math.min(MAX_ZOOM, crop.zoom + 0.25) })}
        >
          <PlusIcon className="size-4" />
        </button>
      </div>
    </div>
  );
}

/**
 * How the cover will sit on the public site: the same 3:2 frame and badge
 * the next-event card uses, with the title currently typed into the form.
 */
function CoverPreview({
  imageUrl,
  image,
  title,
}: {
  imageUrl?: string;
  image?: ImageDisplaySource | null;
  title?: string;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-5">
      <div className="relative sm:w-1/2 sm:shrink-0">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt="Cover preview"
            className="aspect-3/2 w-full object-cover"
          />
        ) : (
          <CoverImage
            image={image ?? null}
            alt="Current cover"
            sizes="320px"
            className="w-full"
          />
        )}
        <Badge pill className="absolute top-0 left-0">
          next event
        </Badge>
      </div>
      <p className="line-clamp-2 text-xl leading-tight font-light tracking-tight">
        {title?.trim() || (
          <span className="text-muted-foreground">Event title</span>
        )}
      </p>
    </div>
  );
}

export function CoverPhotoField({
  field,
  currentImage,
  title,
}: {
  field: FieldMetadata<File | undefined>;
  currentImage?: ImageDisplaySource | null;
  title?: string;
}) {
  const form = useFormMetadata();
  const inputRef = useRef<HTMLInputElement>(null);
  const [source, setSource] = useState<Source | null>(null);
  const [crop, setCrop] = useState<CropState>(INITIAL_CROP);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [applying, setApplying] = useState(false);
  const [cropError, setCropError] = useState<string | null>(null);
  /** The source + crop + output of the last applied crop, for undo/re-crop. */
  const [applied, setApplied] = useState<{
    source: Source;
    crop: CropState;
    file: File;
    previewUrl: string;
  } | null>(null);

  // Object URLs we hand out are revoked on unmount.
  const urls = useRef(new Set<string>());
  const track = (url: string) => {
    urls.current.add(url);
    return url;
  };
  useEffect(() => {
    const owned = urls.current;
    return () => owned.forEach((url) => URL.revokeObjectURL(url));
  }, []);

  const revalidate = useCallback(() => {
    form.validate({ name: field.name });
  }, [form, field.name]);

  async function onFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setCropError(null);
    if (!file) {
      setApplied(null);
      return;
    }
    // Leave anything that isn't a supported image in the input so the
    // schema reports the real problem.
    if (!VALID_IMAGE_TYPES.includes(file.type)) {
      setApplied(null);
      return;
    }
    const url = track(URL.createObjectURL(file));
    try {
      const img = await loadImage(url);
      setSource({
        file,
        url,
        width: img.naturalWidth,
        height: img.naturalHeight,
      });
      setCrop(INITIAL_CROP);
      setDialogOpen(true);
    } catch {
      setApplied(null);
    }
  }

  function cancelCrop() {
    setDialogOpen(false);
    const input = inputRef.current;
    if (!input) return;
    // Put back whatever was there before this pick: the previous crop, or
    // nothing (keeping the current cover on edit).
    setInputFile(input, applied?.file ?? null);
    revalidate();
  }

  async function applyCrop() {
    const input = inputRef.current;
    if (!source || !input) return;
    setApplying(true);
    setCropError(null);
    try {
      const file = await renderCrop(source, crop);
      setInputFile(input, file);
      setApplied({
        source,
        crop,
        file,
        previewUrl: track(URL.createObjectURL(file)),
      });
      setDialogOpen(false);
      revalidate();
    } catch {
      setCropError("Could not crop this photo. Try a different file.");
    } finally {
      setApplying(false);
    }
  }

  function recrop() {
    if (!applied) return;
    setSource(applied.source);
    setCrop(applied.crop);
    setDialogOpen(true);
  }

  function removeNewPhoto() {
    const input = inputRef.current;
    if (input) setInputFile(input, null);
    setApplied(null);
    revalidate();
  }

  const showPreview = Boolean(applied || currentImage);

  return (
    <div className="flex flex-col gap-4">
      {showPreview ? (
        <div className="flex flex-col gap-3">
          <p className="text-muted-foreground text-sm">
            {applied
              ? "Preview — this is how the new cover will look on the site."
              : "Current cover"}
          </p>
          <CoverPreview
            imageUrl={applied?.previewUrl}
            image={currentImage}
            title={title}
          />
          {applied ? (
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={recrop}>
                Adjust crop
              </Button>
              <Button type="button" variant="ghost" onClick={removeNewPhoto}>
                {currentImage ? "Keep current cover" : "Remove photo"}
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}

      <Field
        labelProps={{ children: "Cover" }}
        description={
          applied || currentImage
            ? "Choose a new photo to replace the cover."
            : "JPEG, PNG or WebP. You can crop it to the 3:2 cover frame after choosing."
        }
        inputProps={{
          ...getInputProps(field, { type: "file" }),
          ref: inputRef,
          tabIndex: 0,
          accept: VALID_IMAGE_TYPES.join(","),
          className: fileFieldClassName,
          onChange: onFileChange,
        }}
        errors={field.errors}
      />

      <noscript>
        <p className="text-muted-foreground text-sm">
          Without JavaScript, the form&apos;s buttons reload the page and a
          chosen cover file does not survive the reload — pick the cover image
          last, right before saving.
        </p>
      </noscript>

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          if (!open) cancelCrop();
        }}
      >
        <DialogContent className="max-w-2xl">
          <div className="flex flex-col gap-1">
            <DialogTitle>Crop cover photo</DialogTitle>
            <DialogDescription>
              Drag to reposition, zoom to tighten. The frame is exactly what
              guests will see.
            </DialogDescription>
          </div>

          {source ? (
            <CoverCropper source={source} crop={crop} onChange={setCrop} />
          ) : (
            <div className="bg-muted flex aspect-3/2 items-center justify-center">
              <ImageIcon className="text-muted-foreground size-8" />
            </div>
          )}

          {cropError ? (
            <p className="text-destructive text-sm" role="alert">
              {cropError}
            </p>
          ) : null}

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={cancelCrop}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={applyCrop}
              disabled={!source || applying}
            >
              {applying ? "Cropping…" : "Use photo"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
