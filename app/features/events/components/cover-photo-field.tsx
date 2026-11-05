import type { FieldMetadata } from "@conform-to/react";
import { getInputProps, useFormMetadata } from "@conform-to/react";
import { ImageIcon } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  ImageFramer,
  loadImage,
  type FramerPhoto,
} from "~/components/admin-image-framer";
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
import type { ImageDisplaySource } from "~/shared/image";
import { getImageUrl, VALID_IMAGE_TYPES } from "~/shared/image";
import {
  cropOf,
  framedImageStyle,
  serializeCrop,
  type ImageCrop,
} from "~/shared/image-crop";
import {
  cropFromFraming,
  framingFromCrop,
  INITIAL_FRAMING,
  type Framing,
} from "~/shared/image-framing";
import { useImageConfig } from "~/shared/root-data";

/**
 * Every place a cover appears (event page, next-event card, past-dinner
 * tiles) renders it at 3:2 with object-fit: cover, so framing it in exactly
 * that frame here is what makes the preview honest.
 */
const COVER_ASPECT = 3 / 2;
/**
 * The longest side of an uploaded cover: twice the widest it is shown
 * (1080px) with room to frame tighter later, since the whole photo is kept.
 */
const MAX_UPLOAD_SIDE = 2560;
const MAX_OUTPUT_BYTES = 3 * 1024 * 1024;

type Source = FramerPhoto & {
  /** Used to name the upload. */
  name: string;
};

/**
 * What the field will save: a new photo with its framing, or a new framing
 * for the current cover.
 */
type Applied =
  | {
      kind: "new";
      source: Source;
      framing: Framing;
      crop: ImageCrop;
      file: File;
    }
  | { kind: "current"; source: Source; framing: Framing; crop: ImageCrop };

function canvasToBlob(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Export failed"))),
      "image/jpeg",
      quality,
    );
  });
}

/**
 * The whole photo as the upload, scaled down to MAX_UPLOAD_SIDE and the
 * upload limit. It is not cut to the frame: the framing travels alongside
 * (coverCrop) and can be changed later without a new upload.
 */
async function renderUpload(source: Source): Promise<File> {
  const img = await loadImage(source.url);
  const scale = Math.min(
    1,
    MAX_UPLOAD_SIDE / Math.max(source.width, source.height),
  );
  const outW = Math.round(source.width * scale);
  const outH = Math.round(source.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unsupported");
  // JPEG has no alpha; paint the paper colour under transparent PNGs.
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, outW, outH);
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, outW, outH);

  let blob = await canvasToBlob(canvas, 0.9);
  for (const quality of [0.8, 0.7, 0.6]) {
    if (blob.size <= MAX_OUTPUT_BYTES) break;
    blob = await canvasToBlob(canvas, quality);
  }

  const baseName = source.name.replace(/\.[^.]+$/, "") || "cover";
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

/**
 * How the cover will sit on the public site: the same 3:2 frame and badge
 * the next-event card uses, with the title currently typed into the form.
 */
function CoverPreview({
  applied,
  image,
  title,
}: {
  applied: Applied | null;
  image?: ImageDisplaySource | null;
  title?: string;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-5">
      <div className="relative sm:w-1/2 sm:shrink-0">
        {applied ? (
          <div className="relative aspect-3/2 w-full overflow-hidden">
            <img
              src={applied.source.url}
              alt="Cover preview"
              style={framedImageStyle(
                applied.crop,
                applied.source,
                COVER_ASPECT,
              )}
            />
          </div>
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
  const imageConfig = useImageConfig();
  const [loadingCurrent, setLoadingCurrent] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  /** The photo in the dialog, and whether it is a new pick or the cover. */
  const [editing, setEditing] = useState<{
    kind: Applied["kind"];
    source: Source;
  } | null>(null);
  const [framing, setFraming] = useState<Framing>(INITIAL_FRAMING);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [applying, setApplying] = useState(false);
  const [cropError, setCropError] = useState<string | null>(null);
  /** The last framing applied, for the preview, undo and editing again. */
  const [applied, setApplied] = useState<Applied | null>(null);

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
      setEditing({
        kind: "new",
        source: {
          name: file.name,
          url,
          width: img.naturalWidth,
          height: img.naturalHeight,
        },
      });
      setFraming(INITIAL_FRAMING);
      setDialogOpen(true);
    } catch {
      setApplied(null);
    }
  }

  function cancelCrop() {
    setDialogOpen(false);
    const input = inputRef.current;
    if (editing?.kind !== "new" || !input) return;
    // Put back whatever was there before this pick: the previous new photo,
    // or nothing (keeping the current cover on edit).
    setInputFile(input, applied?.kind === "new" ? applied.file : null);
    if (applied?.kind === "current") setApplied(null);
    revalidate();
  }

  async function applyCrop() {
    const input = inputRef.current;
    if (!editing || !input) return;
    const { kind, source } = editing;
    const crop = cropFromFraming(source, COVER_ASPECT, framing);
    setApplying(true);
    setCropError(null);
    try {
      if (kind === "new") {
        const file = await renderUpload(source);
        setInputFile(input, file);
        setApplied({ kind, source, framing, crop, file });
        revalidate();
      } else {
        setApplied({ kind, source, framing, crop });
      }
      setDialogOpen(false);
    } catch {
      setCropError("Could not edit this photo. Try a different file.");
    } finally {
      setApplying(false);
    }
  }

  function recrop() {
    if (!applied) return;
    setEditing({ kind: applied.kind, source: applied.source });
    setFraming(applied.framing);
    setDialogOpen(true);
  }

  /**
   * Frame the saved cover anew: the stored photo, whole, in the framer at
   * its current framing. Applying it saves only the framing with the event;
   * the file stays as it is.
   */
  async function cropCurrent() {
    if (!currentImage) return;
    setCropError(null);
    setLoadingCurrent(true);
    try {
      const url = getImageUrl(currentImage, imageConfig, { uncropped: true });
      const img = await loadImage(url);
      const source = {
        name: "cover",
        url,
        width: img.naturalWidth,
        height: img.naturalHeight,
      };
      setEditing({ kind: "current", source });
      setFraming(framingFromCrop(source, COVER_ASPECT, cropOf(currentImage)));
      setDialogOpen(true);
    } catch {
      setCropError("Could not load the current cover for editing.");
    } finally {
      setLoadingCurrent(false);
    }
  }

  function discardApplied() {
    const input = inputRef.current;
    if (applied?.kind === "new" && input) {
      setInputFile(input, null);
      revalidate();
    }
    setApplied(null);
  }

  const showPreview = Boolean(applied || currentImage);

  return (
    <div className="flex flex-col gap-4">
      {/* the framing travels with the form; without it the cover's own
          framing stays as it is */}
      {applied ? (
        <input
          type="hidden"
          name="coverCrop"
          value={serializeCrop(applied.crop)}
        />
      ) : null}

      {showPreview ? (
        <div className="flex flex-col gap-3">
          <p className="text-muted-foreground text-sm">
            {applied?.kind === "new"
              ? "Preview — this is how the new cover will look on the site."
              : applied
                ? "Preview — the cover's new framing, saved with the event."
                : "Current cover"}
          </p>
          <CoverPreview applied={applied} image={currentImage} title={title} />
          {applied ? (
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={recrop}>
                Edit photo
              </Button>
              <Button type="button" variant="ghost" onClick={discardApplied}>
                {applied.kind === "current"
                  ? "Undo framing change"
                  : currentImage
                    ? "Keep current cover"
                    : "Remove photo"}
              </Button>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={cropCurrent}
                disabled={loadingCurrent}
              >
                {loadingCurrent ? "Loading…" : "Move or crop current cover"}
              </Button>
            </div>
          )}
          {cropError && !dialogOpen ? (
            <p className="text-destructive-light text-sm" role="alert">
              {cropError}
            </p>
          ) : null}
        </div>
      ) : null}

      <Field
        labelProps={{ children: "Cover" }}
        description={
          applied || currentImage
            ? "Choose a new photo to replace the cover."
            : "JPEG, PNG or WebP. You can move and crop it in the 3:2 cover frame after choosing, and again any time later."
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
            <DialogTitle>Edit cover photo</DialogTitle>
            <DialogDescription>
              Drag to reposition, zoom to tighten. The frame is exactly what
              guests will see; the whole photo is kept, so this can be changed
              again later.
            </DialogDescription>
          </div>

          {editing ? (
            <ImageFramer
              photo={editing.source}
              aspect={COVER_ASPECT}
              framing={framing}
              onChange={setFraming}
            />
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
              disabled={!editing || applying}
            >
              {applying
                ? "Applying…"
                : editing?.kind === "current"
                  ? "Use framing"
                  : "Use photo"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
