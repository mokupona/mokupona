import { CropIcon, MinusIcon, PlusIcon } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { useFetcher } from "react-router";
import { toast } from "sonner";

import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "~/components/ui/dialog";
import { Label } from "~/components/ui/label";
import { cn } from "~/lib/utils";
import { getImageUrl, type ImageDisplaySource } from "~/shared/image";
import { cropOf, serializeCrop } from "~/shared/image-crop";
import {
  clampFraming,
  clampZoom,
  cropAspect,
  cropFromFraming,
  framingFromCrop,
  INITIAL_FRAMING,
  MAX_ZOOM,
  MIN_ZOOM,
  photoPlacement,
  type Framing,
  type Offset,
  type PhotoSize,
} from "~/shared/image-framing";
import { useImageConfig } from "~/shared/root-data";

export interface FramerPhoto extends PhotoSize {
  url: string;
}

export function loadImage(url: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    // Cloudinary photos go on a canvas for the cover upload; without CORS
    // the canvas would be tainted and refuse to export
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not decode image"));
    img.src = url;
  });
}

/**
 * A frame of a fixed shape with the photo behind it: drag (or the arrow
 * keys) to move it, zoom with the slider, the wheel, a pinch or +/-. The
 * frame is exactly what visitors will see.
 */
export function ImageFramer({
  photo,
  aspect,
  framing,
  onChange,
}: {
  photo: FramerPhoto;
  /** the frame's width over its height */
  aspect: number;
  framing: Framing;
  onChange: (framing: Framing) => void;
}) {
  const frameRef = useRef<HTMLDivElement>(null);
  // every pointer on the frame: one drags, two pinch
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{
    start: Offset;
    origin: Offset;
    distance: number;
    zoom: number;
  } | null>(null);
  const zoomId = useId();

  const update = (next: Partial<Framing>) =>
    onChange(clampFraming(photo, aspect, { ...framing, ...next }));

  function frameWidth() {
    return frameRef.current?.getBoundingClientRect().width ?? 1;
  }

  /** Re-anchors the gesture on the pointers now down. */
  function beginGesture() {
    const points = [...pointers.current.values()];
    if (points.length === 0) {
      gesture.current = null;
      return;
    }
    const centre = {
      x: points.reduce((sum, p) => sum + p.x, 0) / points.length,
      y: points.reduce((sum, p) => sum + p.y, 0) / points.length,
    };
    gesture.current = {
      start: centre,
      origin: framing.offset,
      distance:
        points.length > 1
          ? Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y)
          : 0,
      zoom: framing.zoom,
    };
  }

  function onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    pointers.current.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
    });
    beginGesture();
  }

  function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (!pointers.current.has(event.pointerId) || !gesture.current) return;
    pointers.current.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
    });
    const points = [...pointers.current.values()];
    const state = gesture.current;
    const width = frameWidth();
    const centre = {
      x: points.reduce((sum, p) => sum + p.x, 0) / points.length,
      y: points.reduce((sum, p) => sum + p.y, 0) / points.length,
    };
    const zoom =
      points.length > 1 && state.distance > 0
        ? clampZoom(
            (state.zoom *
              Math.hypot(
                points[0].x - points[1].x,
                points[0].y - points[1].y,
              )) /
              state.distance,
          )
        : framing.zoom;

    onChange(
      clampFraming(photo, aspect, {
        zoom,
        offset: {
          x: state.origin.x + (centre.x - state.start.x) / width,
          y: state.origin.y + (centre.y - state.start.y) / width,
        },
      }),
    );
  }

  function onPointerUp(event: React.PointerEvent<HTMLDivElement>) {
    pointers.current.delete(event.pointerId);
    beginGesture();
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
        offset: {
          x: framing.offset.x + move.x,
          y: framing.offset.y + move.y,
        },
      });
    } else if (event.key === "+" || event.key === "=") {
      event.preventDefault();
      update({ zoom: framing.zoom + 0.1 });
    } else if (event.key === "-") {
      event.preventDefault();
      update({ zoom: framing.zoom - 0.1 });
    }
  }

  // Wheel zoom has to be a non-passive native listener to stop the dialog
  // from scrolling underneath.
  const latest = useRef({ framing, photo, aspect, onChange });
  latest.current = { framing, photo, aspect, onChange };
  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const current = latest.current;
      current.onChange(
        clampFraming(current.photo, current.aspect, {
          ...current.framing,
          zoom: current.framing.zoom * Math.exp(-event.deltaY * 0.002),
        }),
      );
    };
    frame.addEventListener("wheel", onWheel, { passive: false });
    return () => frame.removeEventListener("wheel", onWheel);
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <div
        ref={frameRef}
        role="application"
        aria-label="Photo editor. Drag or use the arrow keys to move the photo, plus and minus to zoom."
        tabIndex={0}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onKeyDown={onKeyDown}
        className="bg-muted focus-visible:ring-ring relative mx-auto max-h-[60dvh] w-full cursor-grab touch-none overflow-hidden select-none focus-visible:ring-2 focus-visible:outline-hidden active:cursor-grabbing"
        style={{
          aspectRatio: `${aspect}`,
          // a tall frame stays on screen: its width follows the height cap
          maxWidth: `calc(60dvh * ${aspect})`,
        }}
      >
        <img
          src={photo.url}
          alt=""
          draggable={false}
          className="pointer-events-none absolute max-w-none"
          style={photoPlacement(photo, aspect, framing)}
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
          onClick={() => update({ zoom: framing.zoom - 0.25 })}
        >
          <MinusIcon className="size-4" />
        </button>
        <input
          id={zoomId}
          type="range"
          min={MIN_ZOOM}
          max={MAX_ZOOM}
          step={0.01}
          value={framing.zoom}
          onChange={(event) => update({ zoom: Number(event.target.value) })}
          className="accent-primary grow"
        />
        <button
          type="button"
          aria-label="Zoom in"
          className="text-muted-foreground hover:text-foreground"
          onClick={() => update({ zoom: framing.zoom + 0.25 })}
        >
          <PlusIcon className="size-4" />
        </button>
      </div>
    </div>
  );
}

/** A frame shape an admin can pick; `original` is the photo's own. */
export interface FrameShape {
  label: string;
  aspect: number | "original";
}

/** Board and volunteer portraits are always shown square. */
export const PORTRAIT_SHAPES: FrameShape[] = [{ label: "Square", aspect: 1 }];

/**
 * Gallery photos keep whatever shape they are framed to: the wall takes
 * its rhythm from them.
 */
export const GALLERY_SHAPES: FrameShape[] = [
  { label: "Original", aspect: "original" },
  { label: "Square", aspect: 1 },
  { label: "Portrait 4:5", aspect: 4 / 5 },
  { label: "Landscape 3:2", aspect: 3 / 2 },
  { label: "Wide 16:9", aspect: 16 / 9 },
];

function shapeAspect(shape: FrameShape, photo: PhotoSize) {
  return shape.aspect === "original"
    ? photo.width / photo.height
    : shape.aspect;
}

/** The shape a stored crop was made in, near enough. */
function initialShape(
  shapes: FrameShape[],
  photo: PhotoSize,
  image: ImageDisplaySource,
) {
  const crop = cropOf(image);
  if (!crop || shapes.length === 1) return 0;
  const target = cropAspect(photo, crop);
  let best = 0;
  shapes.forEach((shape, index) => {
    const diff = Math.abs(Math.log(shapeAspect(shape, photo) / target));
    const bestDiff = Math.abs(
      Math.log(shapeAspect(shapes[best], photo) / target),
    );
    if (diff < bestDiff) best = index;
  });
  return best;
}

/**
 * "Adjust photo": opens the whole stored photo in the framer and saves the
 * framing straight away (admin.images.$imageId.crop.ts). The file is never
 * changed; every page showing the image picks the framing up.
 */
export function ImageFramingDialog({
  image,
  shapes,
  title,
  label = "Adjust photo",
  iconOnly = false,
  className,
}: {
  image: ImageDisplaySource & { id: string };
  shapes: FrameShape[];
  title: string;
  label?: string;
  iconOnly?: boolean;
  className?: string;
}) {
  const config = useImageConfig();
  const fetcher = useFetcher<{ ok: boolean; error?: string }>();
  const [open, setOpen] = useState(false);
  const [photo, setPhoto] = useState<FramerPhoto | null>(null);
  const [shape, setShape] = useState(0);
  const [framing, setFraming] = useState<Framing>(INITIAL_FRAMING);
  const [error, setError] = useState<string | null>(null);
  const saving = fetcher.state !== "idle";

  async function openEditor() {
    setError(null);
    setOpen(true);
    try {
      // the whole stored photo, not the framed delivery
      const url = getImageUrl(image, config, { uncropped: true });
      const img = await loadImage(url);
      const loaded = {
        url,
        width: img.naturalWidth,
        height: img.naturalHeight,
      };
      const initial = initialShape(shapes, loaded, image);
      setPhoto(loaded);
      setShape(initial);
      setFraming(
        framingFromCrop(
          loaded,
          shapeAspect(shapes[initial], loaded),
          cropOf(image),
        ),
      );
    } catch {
      setError("Could not load the photo for editing.");
    }
  }

  function changeShape(index: number) {
    if (!photo) return;
    // keep the same part of the photo in view across the change
    const current = cropFromFraming(
      photo,
      shapeAspect(shapes[shape], photo),
      framing,
    );
    setShape(index);
    setFraming(
      framingFromCrop(photo, shapeAspect(shapes[index], photo), current),
    );
  }

  function save(showWhole: boolean) {
    if (!photo) return;
    const aspect = shapeAspect(shapes[shape], photo);
    const crop = showWhole ? null : cropFromFraming(photo, aspect, framing);
    fetcher.submit(
      {
        crop: serializeCrop(crop),
        width: String(photo.width),
        height: String(photo.height),
      },
      { method: "POST", action: `/admin/images/${image.id}/crop` },
    );
  }

  // close once the save has landed; the revalidated page shows the framing
  const settled = useRef(fetcher.data);
  useEffect(() => {
    if (fetcher.state !== "idle" || fetcher.data === settled.current) return;
    settled.current = fetcher.data;
    if (fetcher.data?.ok) {
      toast.success("Photo framing saved");
      setOpen(false);
    } else if (fetcher.data) {
      setError(fetcher.data.error ?? "Could not save the framing.");
    }
  }, [fetcher.state, fetcher.data]);

  const aspect = photo ? shapeAspect(shapes[shape], photo) : 1;

  return (
    <>
      <Button
        type="button"
        variant="outline"
        // the same height as the small buttons it usually sits beside
        size={iconOnly ? "icon" : "sm"}
        aria-label={iconOnly ? label : undefined}
        onClick={openEditor}
        className={className}
      >
        <CropIcon aria-hidden className="size-4" />
        {iconOnly ? null : label}
      </Button>

      <Dialog open={open} onOpenChange={(next) => !saving && setOpen(next)}>
        <DialogContent className="max-w-2xl">
          <div className="flex flex-col gap-1">
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>
              Drag to move the photo, zoom to crop it. The frame shows what
              visitors will see; the photo itself stays whole, so this can be
              changed again any time.
            </DialogDescription>
          </div>

          {shapes.length > 1 ? (
            <div
              role="radiogroup"
              aria-label="Frame shape"
              className="flex flex-wrap gap-2"
            >
              {shapes.map((option, index) => (
                <button
                  key={option.label}
                  type="button"
                  role="radio"
                  aria-checked={index === shape}
                  disabled={!photo}
                  onClick={() => changeShape(index)}
                  className={cn(
                    "border px-3 py-1.5 text-xs font-semibold transition-colors",
                    index === shape
                      ? "border-primary/35 bg-primary/10 text-accent-light"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
          ) : null}

          {photo ? (
            <ImageFramer
              photo={photo}
              aspect={aspect}
              framing={framing}
              onChange={setFraming}
            />
          ) : (
            <div
              className="bg-muted flex w-full items-center justify-center"
              style={{ aspectRatio: `${aspect}` }}
            >
              {error ? null : (
                <span className="text-muted-foreground text-sm">Loading…</span>
              )}
            </div>
          )}

          {error ? (
            <p className="text-destructive text-sm" role="alert">
              {error}
            </p>
          ) : null}

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
            <Button
              type="button"
              variant="ghost"
              onClick={() => save(true)}
              disabled={!photo || saving}
            >
              {shapes[0].aspect === "original"
                ? "Show the whole photo"
                : "Reset to automatic"}
            </Button>
            <div className="flex flex-col-reverse gap-2 sm:flex-row">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={() => save(false)}
                disabled={!photo || saving}
              >
                {saving ? "Saving…" : "Save framing"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
