// Pictures pasted or dropped into a mail message's editor: each one is
// uploaded (app/routes/admin.mail-images.ts) and lands in the Markdown as
// ![](https://…), on a paragraph of its own where the cursor was. While it
// uploads a placeholder holds its place, so typing on is fine; a mail sent
// before it's done leaves the picture out (renderMailMarkdown).

import {
  useCallback,
  useRef,
  useState,
  type ClipboardEvent,
  type DragEvent,
} from "react";

import {
  MAIL_IMAGE_FIELD,
  MAIL_IMAGE_UPLOAD_PATH,
  type MailImageReply,
} from "./mail-images.shared";

import { cn } from "~/lib/utils";

/** Twice the mail's 32rem column, with a little room for a sharp screen. */
const MAX_WIDTH = 1200;
/** What the upload route takes (imageFileSchema). */
const MAX_BYTES = 3 * 1024 * 1024;
/** Formats every mail client shows; anything else is redrawn as one. */
const MAIL_FORMATS = new Set(["image/jpeg", "image/png"]);

const UPLOAD_FAILED = "The image couldn't be uploaded. Try again in a moment.";
const UNREADABLE = "That file couldn't be read as an image. Try a JPEG or PNG.";
const TOO_BIG = "That image is too big for an email, even made smaller.";
const NOT_AN_IMAGE = "Only images can go into an email.";
const WAIT = "Wait for the image to finish uploading.";

class UploadError extends Error {}

function isImage(file: File) {
  return file.type.startsWith("image/");
}

/**
 * The pictures to upload from a paste, or none to let the browser paste as
 * usual. Word and the like put a picture of copied text next to the text
 * itself, and that should paste as the words; text that only names the
 * picture (a copied file's name, a copied image's address) doesn't count.
 */
export function pastedImages(
  data: { files: ArrayLike<File>; getData(format: string): string } | null,
): File[] {
  if (!data) return [];
  const images = Array.from(data.files).filter(isImage);
  if (images.length === 0) return [];

  const text = data.getData("text/plain").trim();
  const onlyNamesTheImage =
    text === "" ||
    images.some((file) => file.name === text) ||
    /^https?:\/\/\S+$/.test(text);
  return onlyNamesTheImage ? images : [];
}

/** `insert` with the line breaks it takes to stand as a paragraph of its own. */
export function asOwnParagraph(
  before: string,
  insert: string,
  after: string,
): string {
  const lead =
    before === "" || before.endsWith("\n\n")
      ? ""
      : before.endsWith("\n")
        ? "\n"
        : "\n\n";
  const trail = after.startsWith("\n\n")
    ? ""
    : after.startsWith("\n")
      ? "\n"
      : "\n\n";
  return `${lead}${insert}${trail}`;
}

/** A placeholder for an upload, told apart from any already in the text. */
export function uploadPlaceholder(value: string, fileName: string): string {
  // brackets would end the Markdown's description early
  const name = fileName.replace(/[[\]\r\n]/g, "").trim() || "image";
  for (let count = 1; ; count++) {
    const label = count === 1 ? name : `${name} (${count})`;
    const placeholder = `![Uploading ${label}…]()`;
    if (!value.includes(placeholder)) return placeholder;
  }
}

function canvasBlob(canvas: HTMLCanvasElement, type: string, quality?: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new UploadError(UNREADABLE))),
      type,
      quality,
    );
  });
}

function renamed(file: File, blob: Blob, extension: string) {
  const base = file.name.replace(/\.[^.]+$/, "") || "image";
  return new File([blob], `${base}.${extension}`, { type: blob.type });
}

/**
 * The picture as a mail should carry it: as it is when it's a JPEG or PNG
 * that fits, else redrawn at most MAX_WIDTH wide, a PNG staying a PNG (crisp
 * text in a screenshot) unless that's still too big, then a JPEG.
 */
async function prepareForMail(file: File): Promise<File> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new UploadError(UNREADABLE);
  }

  try {
    if (
      MAIL_FORMATS.has(file.type) &&
      bitmap.width <= MAX_WIDTH &&
      file.size <= MAX_BYTES
    ) {
      return file;
    }

    const scale = Math.min(1, MAX_WIDTH / bitmap.width);
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) throw new UploadError(UNREADABLE);
    context.imageSmoothingQuality = "high";

    if (file.type === "image/png") {
      context.drawImage(bitmap, 0, 0, width, height);
      const blob = await canvasBlob(canvas, "image/png");
      if (blob.size <= MAX_BYTES) return renamed(file, blob, "png");
    }

    // JPEG has no transparency: white under it, like the mail's page
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, height);
    context.drawImage(bitmap, 0, 0, width, height);
    for (const quality of [0.9, 0.8, 0.7, 0.6]) {
      const blob = await canvasBlob(canvas, "image/jpeg", quality);
      if (blob.size <= MAX_BYTES) return renamed(file, blob, "jpg");
    }
    throw new UploadError(TOO_BIG);
  } finally {
    bitmap.close();
  }
}

async function uploadForMail(file: File): Promise<string> {
  const body = new FormData();
  body.append(MAIL_IMAGE_FIELD, file, file.name);

  let reply: MailImageReply | null = null;
  try {
    const response = await fetch(MAIL_IMAGE_UPLOAD_PATH, {
      method: "POST",
      body,
      headers: { Accept: "application/json" },
    });
    reply = (await response.json()) as MailImageReply;
  } catch {
    // offline, or not the route's reply (signed out in the meantime)
  }

  if (!reply) throw new UploadError(UPLOAD_FAILED);
  if (!reply.ok) throw new UploadError(reply.error);
  return reply.url;
}

/** Lets the form, and Conform, know the text changed under them. */
function notify(textarea: HTMLTextAreaElement) {
  textarea.dispatchEvent(new Event("input", { bubbles: true }));
}

function insertAtCursor(textarea: HTMLTextAreaElement, insert: string) {
  const { selectionStart: start, selectionEnd: end, value } = textarea;
  textarea.setRangeText(
    asOwnParagraph(value.slice(0, start), insert, value.slice(end)),
    start,
    end,
    "end",
  );
  notify(textarea);
}

function replacePlaceholder(
  textarea: HTMLTextAreaElement,
  placeholder: string,
  replacement: string,
) {
  // the form went away, or the admin took the placeholder out meanwhile
  if (!textarea.isConnected) return;
  const start = textarea.value.indexOf(placeholder);
  if (start === -1) return;
  textarea.setRangeText(
    replacement,
    start,
    start + placeholder.length,
    "preserve",
  );
  notify(textarea);
}

/**
 * Paste and drop for a mail message's textarea: spread `handlers` on it and
 * put `status` under it, where uploads and their errors show.
 */
export function useMailImagePaste() {
  const [uploading, setUploading] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const pending = useRef(0);

  const add = useCallback((textarea: HTMLTextAreaElement, files: File[]) => {
    setError(null);
    textarea.focus();

    for (const file of files) {
      const placeholder = uploadPlaceholder(textarea.value, file.name);
      insertAtCursor(textarea, placeholder);

      pending.current += 1;
      setUploading(pending.current);
      // a form the browser checks won't send half an email
      textarea.setCustomValidity(WAIT);

      prepareForMail(file)
        .then(uploadForMail)
        .then(
          (url) => replacePlaceholder(textarea, placeholder, `![](${url})`),
          (reason: unknown) => {
            replacePlaceholder(textarea, placeholder, "");
            setError(
              reason instanceof UploadError ? reason.message : UPLOAD_FAILED,
            );
          },
        )
        .finally(() => {
          pending.current -= 1;
          setUploading(pending.current);
          if (pending.current === 0) textarea.setCustomValidity("");
        });
    }
  }, []);

  const handlers = {
    onPaste(event: ClipboardEvent<HTMLTextAreaElement>) {
      const files = pastedImages(event.clipboardData);
      if (files.length === 0) return;
      event.preventDefault();
      add(event.currentTarget, files);
    },
    onDragOver(event: DragEvent<HTMLTextAreaElement>) {
      if (!Array.from(event.dataTransfer.types).includes("Files")) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = "copy";
    },
    onDrop(event: DragEvent<HTMLTextAreaElement>) {
      const dropped = Array.from(event.dataTransfer.files);
      // dropped text drops as usual
      if (dropped.length === 0) return;
      // and a file never opens in place of the page
      event.preventDefault();
      const files = dropped.filter(isImage);
      if (files.length === 0) {
        setError(NOT_AN_IMAGE);
        return;
      }
      add(event.currentTarget, files);
    },
  };

  const status = (
    <p
      role="status"
      className={cn(
        "text-xs empty:hidden",
        error ? "text-destructive" : "text-muted-foreground",
      )}
    >
      {error ??
        (uploading === 0
          ? null
          : uploading === 1
            ? "Uploading the image…"
            : `Uploading ${uploading} images…`)}
    </p>
  );

  return { handlers, status };
}
