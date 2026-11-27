// Under a mail editor: a live preview of the mail as it would go out, and a
// button that sends it to the admin writing it, alone. Both render on the
// server (app/routes/admin.mail-preview.ts) through the same templates as
// the real thing, filled in for the first person it would reach.

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "react-router";

import { Button } from "~/components/ui/button";
import type { SignupMailKind } from "~/features/signup-form/confirmation-mail";
import {
  MAIL_DRAFT_PATH,
  type MailDraftKind,
  type MailDraftRecipient,
  type MailDraftReply,
} from "~/features/signup-form/mail-drafts.shared";
import { cn } from "~/lib/utils";

/** How long typing has to pause before the preview catches up. */
const PREVIEW_DELAY_MS = 400;
/** Fields of the editor's form that change who the mail is for. */
const LIST_FIELDS = ["audience", "group", "recipient"];
/** Fields of a new event's form that the signup mail shows. */
const EVENT_FIELDS = ["title", "price"];

const PREVIEW_FAILED = "The preview couldn't be loaded. Try again in a moment.";
const TEST_FAILED = "The test email couldn't be sent. Try again in a moment.";

export interface MailDraftToolsProps {
  kind: MailDraftKind;
  /** The event's id: the page's own `eventId` unless given. */
  eventId?: string;
  /** For a message to one group. */
  submissionId?: string;
  /** For an event's signup mail: which of the two. */
  status?: SignupMailKind;
  /** The names of the editor's subject and message fields in its form. */
  subjectName?: string;
  messageName?: string;
  /** Whether the preview shows from the start. */
  defaultOpen?: boolean;
  className?: string;
}

type Preview =
  | { state: "loading" }
  | {
      state: "ready";
      subject: string;
      html: string;
      recipient: MailDraftRecipient | null;
      recipientCount: number | null;
    }
  | { state: "error"; error: string };

type Test =
  | { state: "idle" }
  | { state: "sending" }
  | { state: "sent"; to: string }
  | { state: "error"; error: string };

async function post(body: FormData, signal?: AbortSignal) {
  const response = await fetch(MAIL_DRAFT_PATH, {
    method: "POST",
    body,
    signal,
    headers: { Accept: "application/json" },
  });
  return (await response.json()) as MailDraftReply;
}

/** Who the preview shows the mail for, in a line above it. */
function previewFor(
  preview: Extract<Preview, { state: "ready" }>,
  kind: MailDraftKind,
): string {
  const { recipient, recipientCount } = preview;
  if (recipient) {
    const who = `${recipient.name} (${recipient.email})`;
    if (kind === "signup") return `Shown with the signup of ${who}.`;
    return recipientCount !== null && recipientCount > 1
      ? `As ${who} will get it, the first of ${recipientCount}.`
      : `As ${who} will get it.`;
  }
  return kind === "signup"
    ? "Nobody has signed up yet, so it's filled in for you as the only guest."
    : "Nobody would get it as things stand, so it's filled in for you as the only guest.";
}

/** The mail, sized to its content, its links opening in a new tab. */
function MailFrame({ html }: { html: string }) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const observerRef = useRef<ResizeObserver | null>(null);
  const [height, setHeight] = useState(320);

  // The mail's own height, kept as it changes: as its pictures land, or as
  // the frame's width wraps its lines. Measured on the mail's root, not the
  // scroll height, which never drops below the frame's own.
  const fit = useCallback(() => {
    const frame = frameRef.current;
    const root = frame?.contentDocument?.documentElement;
    const view = frame?.contentWindow as (Window & typeof globalThis) | null;
    if (!root || !view) return;

    const resize = () => {
      const measured = Math.ceil(root.getBoundingClientRect().height);
      if (measured > 0) setHeight(measured);
    };
    resize();
    observerRef.current?.disconnect();
    const Observer = view.ResizeObserver ?? globalThis.ResizeObserver;
    if (!Observer) return;
    observerRef.current = new Observer(resize);
    observerRef.current.observe(root);
  }, []);

  // a load that happened before React listened still gets measured
  useEffect(() => {
    const timer = setTimeout(fit, 50);
    return () => clearTimeout(timer);
  }, [html, fit]);

  useEffect(() => () => observerRef.current?.disconnect(), []);

  return (
    <iframe
      ref={frameRef}
      title="Email preview"
      srcDoc={html}
      onLoad={fit}
      // no scripts: the page only reads its height
      sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
      className="block w-full bg-white"
      style={{ height }}
    />
  );
}

export function MailDraftTools({
  kind,
  eventId: givenEventId,
  submissionId,
  status,
  subjectName = "subject",
  messageName = "message",
  defaultOpen = true,
  className,
}: MailDraftToolsProps) {
  const params = useParams();
  const eventId = givenEventId ?? params.eventId;
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(defaultOpen);
  const [preview, setPreview] = useState<Preview>({ state: "loading" });
  const [lastReady, setLastReady] = useState<Extract<
    Preview,
    { state: "ready" }
  > | null>(null);
  const [test, setTest] = useState<Test>({ state: "idle" });

  /** The draft as the editor's form has it right now. */
  const draft = useCallback(
    (intent: "preview" | "test") => {
      const form = rootRef.current?.closest("form");
      const fields = form ? new FormData(form) : new FormData();
      const body = new FormData();
      body.set("intent", intent);
      body.set("kind", kind);
      if (eventId) body.set("eventId", eventId);
      if (submissionId) body.set("submissionId", submissionId);
      if (status) body.set("status", status);
      body.set("subject", String(fields.get(subjectName) ?? ""));
      body.set("message", String(fields.get(messageName) ?? ""));
      for (const name of LIST_FIELDS) {
        for (const value of fields.getAll(name)) body.append(name, value);
      }
      if (!eventId) {
        for (const name of EVENT_FIELDS) {
          const value = fields.get(name);
          if (typeof value === "string") body.set(name, value);
        }
      }
      return body;
    },
    [kind, eventId, submissionId, status, subjectName, messageName],
  );

  // while it's open, the preview follows what's typed and picked
  useEffect(() => {
    if (!open) return;
    const form = rootRef.current?.closest("form");
    let timer: ReturnType<typeof setTimeout> | undefined;
    let controller: AbortController | null = null;

    const refresh = () => {
      controller?.abort();
      controller = new AbortController();
      setPreview({ state: "loading" });
      post(draft("preview"), controller.signal).then(
        (reply) => {
          if (reply.ok && reply.intent === "preview") {
            const ready = { state: "ready" as const, ...reply };
            setPreview(ready);
            setLastReady(ready);
          } else {
            setPreview({
              state: "error",
              error: reply.ok ? PREVIEW_FAILED : reply.error,
            });
          }
        },
        (error: unknown) => {
          if (error instanceof DOMException && error.name === "AbortError") {
            return;
          }
          setPreview({ state: "error", error: PREVIEW_FAILED });
        },
      );
    };
    const later = () => {
      clearTimeout(timer);
      timer = setTimeout(refresh, PREVIEW_DELAY_MS);
    };

    refresh();
    form?.addEventListener("input", later);
    form?.addEventListener("change", later);
    form?.addEventListener("reset", later);
    return () => {
      clearTimeout(timer);
      controller?.abort();
      form?.removeEventListener("input", later);
      form?.removeEventListener("change", later);
      form?.removeEventListener("reset", later);
    };
  }, [open, draft]);

  async function sendTest() {
    // a picture still uploading would be left out of the test
    const message = rootRef.current
      ?.closest("form")
      ?.elements.namedItem(messageName);
    if (message instanceof HTMLTextAreaElement && message.validationMessage) {
      setTest({ state: "error", error: message.validationMessage });
      return;
    }

    setTest({ state: "sending" });
    try {
      const reply = await post(draft("test"));
      setTest(
        reply.ok && reply.intent === "test"
          ? { state: "sent", to: reply.sentTo }
          : { state: "error", error: reply.ok ? TEST_FAILED : reply.error },
      );
    } catch {
      setTest({ state: "error", error: TEST_FAILED });
    }
  }

  const shown = preview.state === "ready" ? preview : lastReady;

  return (
    <div ref={rootRef} className={cn("flex flex-col gap-3", className)}>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
        >
          {open ? "Hide preview" : "Preview"}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={test.state === "sending"}
          onClick={sendTest}
        >
          {test.state === "sending" ? "Sending the test…" : "Send a test to me"}
        </Button>
        <span
          role="status"
          className={cn(
            "text-sm",
            test.state === "error"
              ? "text-destructive"
              : "text-muted-foreground",
          )}
        >
          {test.state === "sent"
            ? `Test sent to ${test.to}, marked [Test]. Nobody else got it.`
            : test.state === "error"
              ? test.error
              : null}
        </span>
      </div>

      {open ? (
        <div className="bg-background flex flex-col border">
          <div className="flex flex-col gap-0.5 border-b px-3 py-2 text-sm">
            <p>
              <span className="text-muted-foreground">Subject: </span>
              {shown
                ? shown.subject || (
                    <span className="text-muted-foreground">(none yet)</span>
                  )
                : null}
              {preview.state === "loading" ? (
                <span className="text-muted-foreground"> · updating…</span>
              ) : null}
            </p>
            {shown ? (
              <p className="text-muted-foreground text-xs">
                {previewFor(shown, kind)}
              </p>
            ) : null}
            {preview.state === "error" ? (
              <p role="alert" className="text-destructive text-xs">
                {preview.error}
              </p>
            ) : null}
          </div>
          {shown ? <MailFrame html={shown.html} /> : null}
        </div>
      ) : null}
    </div>
  );
}
