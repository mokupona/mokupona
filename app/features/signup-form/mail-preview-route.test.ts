// @vitest-environment node
import { RouterContextProvider } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { buildEventData, createTestUser } from "../../../test/factories";

import { prisma } from "~/db.server";
import { userContext } from "~/features/auth/middleware.server";
import { sendTemplate, sendTestMail } from "~/features/mail/mail.server";
import type { MailDraftReply } from "~/features/signup-form/mail-drafts.shared";
import { createEventSignup } from "~/models/event-signup.server";
import { createEvent } from "~/models/event.server";
import { getCurrentFormVersion } from "~/models/form.server";
import { getUserByIdWithRole } from "~/models/user.server";
import { action } from "~/routes/admin.mail-preview";

vi.mock("~/features/mail/mail.server", () => ({
  sendTemplate: vi.fn(),
  sendTestMail: vi.fn(),
  guestMailCopyTo: () => null,
}));
const sendTemplateMock = vi.mocked(sendTemplate);
const sendTestMailMock = vi.mocked(sendTestMail);

beforeEach(() => {
  sendTemplateMock.mockReset();
  sendTestMailMock.mockReset();
  sendTestMailMock.mockResolvedValue();
});

async function createTestEvent() {
  const event = await createEvent({ ...(await buildEventData()), slots: 10 });
  const version = await getCurrentFormVersion(event.formId);

  const signUp = (
    email: string,
    friends: { name: string; friend_email?: string }[] = [],
  ) =>
    createEventSignup({
      eventId: event.id,
      formVersionId: version.id,
      expectedVersionUpdatedAt: version.updatedAt,
      email,
      answers: {
        name: email.split("@")[0],
        email,
        phone: "0791234567",
        friends,
      },
    });

  return { event, signUp };
}

/** Runs the action as a fresh moderator: their reply, its status, them. */
async function draft(body: [string, string][]) {
  const moderator = await createTestUser("moderator");
  const context = new RouterContextProvider();
  context.set(userContext, (await getUserByIdWithRole(moderator.id)) as never);

  const response = await action({
    params: {},
    request: new Request("http://localhost:3000/admin/mail-preview", {
      method: "POST",
      body: new URLSearchParams(body),
    }),
    context,
  } as unknown as Parameters<typeof action>[0]);

  return {
    reply: (await response.json()) as MailDraftReply,
    status: response.status,
    moderator,
  };
}

function preview(reply: MailDraftReply) {
  if (!reply.ok || reply.intent !== "preview") {
    throw new Error(`Not a preview: ${JSON.stringify(reply)}`);
  }
  return reply;
}

describe("POST /admin/mail-preview", () => {
  it("shows the message to everyone as its first recipient gets it", async () => {
    const { event, signUp } = await createTestEvent();
    await signUp("first@example.com");
    await signUp("ada@example.com", [
      { name: "Grace", friend_email: "grace@example.com" },
    ]);

    const { reply, status } = await draft([
      ["intent", "preview"],
      ["kind", "everyone"],
      ["eventId", event.id],
      ["audience", "confirmed"],
      ["subject", "Hi {name}"],
      ["message", "See you, **{name}**. Bring {total}."],
    ]);

    expect(status).toBe(200);
    const shown = preview(reply);
    expect(shown.subject).toBe("Hi first");
    expect(shown.html).toContain(
      "See you, <strong>first</strong>. Bring 20 CHF.",
    );
    expect(shown.recipient).toEqual({
      name: "first",
      email: "first@example.com",
    });
    expect(shown.recipientCount).toBe(3);
    expect(sendTemplateMock).not.toHaveBeenCalled();
  });

  it("fills it in for the writer when nobody would get it yet", async () => {
    const { event } = await createTestEvent();

    const { reply, moderator } = await draft([
      ["intent", "preview"],
      ["kind", "everyone"],
      ["eventId", event.id],
      ["audience", "confirmed"],
      ["subject", "Hi {name}"],
      ["message", "{guests} guest, {total}"],
    ]);

    const shown = preview(reply);
    expect(shown.subject).toBe(`Hi ${moderator.name}`);
    expect(shown.html).toContain("1 guest, 20 CHF");
    expect(shown.recipient).toBeNull();
    expect(shown.recipientCount).toBe(0);
  });

  it("shows the payment reminder for the first group due one", async () => {
    const { event, signUp } = await createTestEvent();
    await signUp("ada@example.com", [{ name: "Grace" }]);

    const shown = preview(
      (
        await draft([
          ["intent", "preview"],
          ["kind", "reminder"],
          ["eventId", event.id],
          ["subject", "Your first half"],
          ["message", "Hi {name}, please send {half}."],
        ])
      ).reply,
    );

    expect(shown.html).toContain("Hi ada, please send 20 CHF.");
    expect(shown.recipient).toEqual({ name: "ada", email: "ada@example.com" });
    expect(shown.recipientCount).toBe(1);
  });

  it("shows a message to one group for the first person picked", async () => {
    const { event, signUp } = await createTestEvent();
    const signup = await signUp("ada@example.com", [
      { name: "Grace", friend_email: "grace@example.com" },
    ]);

    const shown = preview(
      (
        await draft([
          ["intent", "preview"],
          ["kind", "message"],
          ["eventId", event.id],
          ["submissionId", signup.id],
          ["recipient", "1"],
          ["subject", "For {name}"],
          ["message", "Hello"],
        ])
      ).reply,
    );

    expect(shown.subject).toBe("For Grace");
    expect(shown.recipient).toEqual({
      name: "Grace",
      email: "grace@example.com",
    });
  });

  it("shows an event's signup mail with its default text when left blank", async () => {
    const { event, signUp } = await createTestEvent();
    await signUp("ada@example.com");

    const blank = preview(
      (
        await draft([
          ["intent", "preview"],
          ["kind", "signup"],
          ["eventId", event.id],
          ["status", "confirmed"],
          ["subject", ""],
          ["message", ""],
        ])
      ).reply,
    );
    expect(blank.subject).toContain(event.title);
    expect(blank.recipient).toEqual({ name: "ada", email: "ada@example.com" });

    const own = preview(
      (
        await draft([
          ["intent", "preview"],
          ["kind", "signup"],
          ["eventId", event.id],
          ["status", "waitlisted"],
          ["subject", "Waiting, {name}"],
          ["message", "![](https://example.com/menu.png)"],
        ])
      ).reply,
    );
    expect(own.subject).toBe("Waiting, ada");
    expect(own.html).toContain('<img src="https://example.com/menu.png"');
  });

  it("previews a new event's signup mail from what its form says", async () => {
    const { reply, moderator } = await draft([
      ["intent", "preview"],
      ["kind", "signup"],
      ["status", "confirmed"],
      ["title", "Winter table"],
      ["price", "45"],
      ["subject", "{event}"],
      ["message", "Hi {name}, that's {total}."],
    ]);

    const shown = preview(reply);
    expect(shown.subject).toBe("Winter table");
    expect(shown.html).toContain(`Hi ${moderator.name}, that&#39;s 45 CHF.`);
    expect(shown.recipient).toBeNull();
  });

  it("sends a test to the writer alone, keeping it on no record", async () => {
    const { event, signUp } = await createTestEvent();
    const signup = await signUp("ada@example.com");

    const { reply, moderator } = await draft([
      ["intent", "test"],
      ["kind", "everyone"],
      ["eventId", event.id],
      ["audience", "confirmed"],
      ["subject", "Hi {name}"],
      ["message", "Menu below."],
    ]);

    expect(reply).toEqual({
      ok: true,
      intent: "test",
      sentTo: moderator.email,
    });
    expect(sendTestMailMock).toHaveBeenCalledOnce();
    const [to, body, options] = sendTestMailMock.mock.calls[0];
    expect(to).toBe(moderator.email);
    expect(body.subject).toBe("Hi ada");
    expect(body.html).toContain("Menu below.");
    expect(options).toEqual({
      from: "moku pona <noreply@mokupona.ch>",
      replyTo: "contact@mokupona.ch",
    });
    // no guest mail went out, and none is on the group's record
    expect(sendTemplateMock).not.toHaveBeenCalled();
    expect(
      await prisma.signupMail.count({ where: { submissionId: signup.id } }),
    ).toBe(0);
  });

  it("won't send a test without a subject", async () => {
    const { event } = await createTestEvent();

    const { reply, status } = await draft([
      ["intent", "test"],
      ["kind", "everyone"],
      ["eventId", event.id],
      ["subject", ""],
      ["message", "Hello"],
    ]);

    expect(status).toBe(400);
    expect(reply).toEqual({ ok: false, error: "The email needs a subject." });
    expect(sendTestMailMock).not.toHaveBeenCalled();
  });

  it("says so when the mail can't go out", async () => {
    const { event } = await createTestEvent();
    sendTestMailMock.mockRejectedValue(new Error("Resend is down"));

    const { reply, status } = await draft([
      ["intent", "test"],
      ["kind", "reminder"],
      ["eventId", event.id],
      ["subject", "Pay"],
      ["message", "Please"],
    ]);

    expect(status).toBe(502);
    expect(reply).toEqual({
      ok: false,
      error: "The test email couldn't be sent. The error is in the logs.",
    });
  });

  it("404s for a signup of another event", async () => {
    const { event } = await createTestEvent();
    const other = await createTestEvent();
    const signup = await other.signUp("ada@example.com");

    const { status } = await draft([
      ["intent", "preview"],
      ["kind", "message"],
      ["eventId", event.id],
      ["submissionId", signup.id],
      ["subject", "Hi"],
      ["message", "Hello"],
    ]);

    expect(status).toBe(404);
  });
});
