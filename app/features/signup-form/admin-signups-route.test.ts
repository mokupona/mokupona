// @vitest-environment node
import { RouterContextProvider } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { buildEventData, createTestUser } from "../../../test/factories";

import { userContext } from "~/features/auth/middleware.server";
import { sendTemplate } from "~/features/mail/mail.server";
import { createEventSignup, getSeatCounts } from "~/models/event-signup.server";
import { createEvent } from "~/models/event.server";
import { getCurrentFormVersion } from "~/models/form.server";
import { getUserByIdWithRole } from "~/models/user.server";
import { action } from "~/routes/admin.events.$eventId_.signups";
import { getToast } from "~/utils/toast.server";

vi.mock("~/features/mail/mail.server", () => ({ sendTemplate: vi.fn() }));
const sendTemplateMock = vi.mocked(sendTemplate);

beforeEach(() => {
  sendTemplateMock.mockReset();
  sendTemplateMock.mockResolvedValue();
});

async function createTestEvent(slots: number) {
  const event = await createEvent({ ...(await buildEventData()), slots });
  const version = await getCurrentFormVersion(event.formId);

  const signUp = (email: string, friends: string[] = []) =>
    createEventSignup({
      eventId: event.id,
      formVersionId: version.id,
      expectedVersionUpdatedAt: version.updatedAt,
      email,
      answers: {
        name: email.split("@")[0],
        email,
        phone: "0791234567",
        friends: friends.map((name) => ({ name })),
      },
    });

  return { event, signUp };
}

async function post(eventId: string, body: Record<string, string>) {
  const moderator = await createTestUser("moderator");
  const context = new RouterContextProvider();
  context.set(userContext, (await getUserByIdWithRole(moderator.id)) as never);

  const response = (await action({
    params: { eventId },
    request: new Request(
      `http://localhost:3000/admin/events/${eventId}/signups`,
      { method: "POST", body: new URLSearchParams(body) },
    ),
    context,
  } as unknown as Parameters<typeof action>[0])) as Response;

  const { toast } = await getToast(
    new Request("http://localhost:3000", {
      headers: { cookie: response.headers.get("set-cookie") ?? "" },
    }),
  );

  return { response, toast };
}

describe("admin signup status action", () => {
  it("confirms a waiting group and emails them their seat", async () => {
    const { event, signUp } = await createTestEvent(1);
    await signUp("first@example.com");
    const waiting = await signUp("ada@example.com", ["Grace"]);

    const { response, toast } = await post(event.id, {
      intent: "confirm",
      submissionId: waiting.id,
    });

    expect(response.status).toBe(302);
    expect(toast).toMatchObject({ type: "success", title: "Seat confirmed" });
    expect(await getSeatCounts(event.id)).toEqual({
      confirmed: 3,
      waitlisted: 0,
    });

    expect(sendTemplateMock).toHaveBeenCalledOnce();
    const [template, to, props] = sendTemplateMock.mock.calls[0];
    expect(template).toBe("signupConfirmation");
    expect(to).toBe("ada@example.com");
    expect(props).toMatchObject({
      status: "confirmed",
      booking: { guests: [{ name: "ada" }, { name: "Grace" }] },
    });
  });

  it("moves and cancels without emailing anyone", async () => {
    const { event, signUp } = await createTestEvent(5);
    const signup = await signUp("ada@example.com");

    const moved = await post(event.id, {
      intent: "waitlist",
      submissionId: signup.id,
    });
    expect(moved.toast).toMatchObject({ title: "Moved to the waiting list" });

    const cancelled = await post(event.id, {
      intent: "cancel",
      submissionId: signup.id,
    });
    expect(cancelled.toast).toMatchObject({ title: "Signup cancelled" });

    expect(sendTemplateMock).not.toHaveBeenCalled();
    expect(await getSeatCounts(event.id)).toEqual({
      confirmed: 0,
      waitlisted: 0,
    });
  });

  it("says so when the seat is confirmed but the email fails", async () => {
    const { event, signUp } = await createTestEvent(0);
    const waiting = await signUp("ada@example.com");
    sendTemplateMock.mockRejectedValue(new Error("Resend rejected it"));

    const { toast } = await post(event.id, {
      intent: "confirm",
      submissionId: waiting.id,
    });

    expect(toast).toMatchObject({
      type: "error",
      title: "Seat confirmed, but the email failed",
    });
    expect((await getSeatCounts(event.id)).confirmed).toBe(1);
  });

  it("won't revive a cancelled signup after the same email signed up again", async () => {
    const { event, signUp } = await createTestEvent(5);
    const first = await signUp("ada@example.com");
    await post(event.id, { intent: "cancel", submissionId: first.id });
    await signUp("ada@example.com");

    const { toast } = await post(event.id, {
      intent: "confirm",
      submissionId: first.id,
    });

    expect(toast).toMatchObject({
      type: "error",
      title: "This signup can't be restored",
    });
    expect((await getSeatCounts(event.id)).confirmed).toBe(1);
  });

  it("rejects unknown intents and signups from other events", async () => {
    const { event } = await createTestEvent(5);
    const other = await createTestEvent(5);
    const elsewhere = await other.signUp("ada@example.com");

    await expect(
      post(event.id, { intent: "delete", submissionId: elsewhere.id }),
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      post(event.id, { intent: "cancel", submissionId: elsewhere.id }),
    ).rejects.toMatchObject({ status: 404 });
  });
});
