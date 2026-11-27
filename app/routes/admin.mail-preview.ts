import type { Route } from "./+types/admin.mail-preview";

import {
  requestLoggerContext,
  userContext,
} from "~/features/auth/middleware.server";
import { sendTestMail } from "~/features/mail/mail.server";
import {
  MAX_SIGNUP_MAIL_MESSAGE_LENGTH,
  MAX_SIGNUP_MAIL_SUBJECT_LENGTH,
  type SignupMailKind,
} from "~/features/signup-form/confirmation-mail";
import { isEveryoneMailStatus } from "~/features/signup-form/everyone-mail";
import {
  DraftNotFoundError,
  renderMailDraft,
  type MailDraft,
} from "~/features/signup-form/mail-drafts.server";
import {
  isMailDraftKind,
  type MailDraftReply,
} from "~/features/signup-form/mail-drafts.shared";
import { getDomainUrl } from "~/shared/http.server";

function reply(body: MailDraftReply, status = 200) {
  return Response.json(body, { status });
}

function text(formData: FormData, name: string) {
  const value = formData.get(name);
  // a textarea sends its line breaks as \r\n
  return typeof value === "string" ? value.replace(/\r\n?/g, "\n").trim() : "";
}

function texts(formData: FormData, name: string) {
  return formData
    .getAll(name)
    .filter((value): value is string => typeof value === "string" && !!value);
}

/** The draft the editor sent, or why it can't be shown. */
function readDraft(formData: FormData): MailDraft | { error: string } {
  const kind = formData.get("kind");
  const eventId = text(formData, "eventId");
  const copy = {
    subject: text(formData, "subject"),
    message: text(formData, "message"),
  };

  if (copy.subject.length > MAX_SIGNUP_MAIL_SUBJECT_LENGTH) {
    return {
      error: `Keep the subject to ${MAX_SIGNUP_MAIL_SUBJECT_LENGTH} characters.`,
    };
  }
  if (copy.message.length > MAX_SIGNUP_MAIL_MESSAGE_LENGTH) {
    return {
      error: `Keep the message to ${MAX_SIGNUP_MAIL_MESSAGE_LENGTH} characters.`,
    };
  }
  if (!isMailDraftKind(kind)) return { error: "Unknown kind of email." };
  if (kind !== "signup" && !eventId) return { error: "Which event is it for?" };

  switch (kind) {
    case "everyone":
      return {
        kind,
        eventId,
        statuses: [...new Set(texts(formData, "audience"))].filter(
          isEveryoneMailStatus,
        ),
        copy,
      };
    case "reminder":
      return { kind, eventId, submissionIds: texts(formData, "group"), copy };
    case "message": {
      const submissionId = text(formData, "submissionId");
      if (!submissionId) return { error: "Which signup is it for?" };
      return {
        kind,
        eventId,
        submissionId,
        guestIndexes: texts(formData, "recipient")
          .map(Number)
          .filter((index) => Number.isInteger(index) && index >= 0),
        copy,
      };
    }
    case "signup": {
      const status = formData.get("status");
      if (status !== "confirmed" && status !== "waitlisted") {
        return { error: "Which signup email is it?" };
      }
      const price = Number(text(formData, "price"));
      return {
        kind,
        eventId: eventId || null,
        newEvent: {
          title: text(formData, "title"),
          price: Number.isFinite(price) && price >= 0 ? price : 0,
        },
        status: status satisfies SignupMailKind,
        copy,
      };
    }
  }
}

/**
 * Renders a mail an admin is writing (app/features/mail/
 * admin-mail-draft-tools.tsx) exactly as it would go out, to preview it or,
 * with intent=test, to send it to that admin alone. Staff only, by way of
 * the admin layout's middleware.
 */
export async function action({ request, context }: Route.ActionArgs) {
  const log = context.get(requestLoggerContext);
  const user = context.get(userContext);
  const formData = await request.formData();
  const intent = formData.get("intent") === "test" ? "test" : "preview";

  const draft = readDraft(formData);
  if ("error" in draft) return reply({ ok: false, error: draft.error }, 400);

  // the signup mail's blank fields stand for the default text; the others
  // can't go out without words
  if (intent === "test" && draft.kind !== "signup") {
    if (!draft.copy.subject) {
      return reply({ ok: false, error: "The email needs a subject." }, 400);
    }
    if (!draft.copy.message) {
      return reply({ ok: false, error: "The email needs a message." }, 400);
    }
  }

  let rendered: Awaited<ReturnType<typeof renderMailDraft>>;
  try {
    rendered = await renderMailDraft(draft, {
      origin: getDomainUrl(request),
      writer: { name: user.name, email: user.email },
    });
  } catch (error) {
    if (error instanceof DraftNotFoundError) {
      return reply(
        { ok: false, error: "That event or signup doesn't exist any more." },
        404,
      );
    }
    throw error;
  }

  if (intent === "preview") {
    return reply({
      ok: true,
      intent,
      subject: rendered.body.subject,
      html: rendered.body.html ?? "",
      recipient: rendered.recipient,
      recipientCount: rendered.recipientCount,
    });
  }

  try {
    await sendTestMail(user.email, rendered.body, {
      from: rendered.from,
      replyTo: rendered.replyTo,
    });
  } catch {
    // sendTestMail has logged why
    return reply(
      {
        ok: false,
        error: "The test email couldn't be sent. The error is in the logs.",
      },
      502,
    );
  }

  log.info(
    {
      userId: user.id,
      kind: draft.kind,
      event: "eventId" in draft ? draft.eventId : null,
    },
    "Admin sent themselves a test email",
  );
  return reply({ ok: true, intent, sentTo: user.email });
}
