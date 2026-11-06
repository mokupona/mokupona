// @vitest-environment node
import { RouterContextProvider } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { buildEventData, createTestUser } from "../../../test/factories";

import { prisma } from "~/db.server";
import { userContext } from "~/features/auth/middleware.server";
import { sendTemplate } from "~/features/mail/mail.server";
import {
  createEventSignup,
  getSeatCounts,
  updateSignupStatus,
} from "~/models/event-signup.server";
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

  // a friend given as an object comes with the address they gave
  const signUp = (
    email: string,
    friends: (string | { name: string; friend_email: string })[] = [],
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
        friends: friends.map((friend) =>
          typeof friend === "string" ? { name: friend } : friend,
        ),
      },
    });

  return { event, signUp };
}

/** Runs the action as a fresh moderator, returning what it answered. */
async function callAction(
  eventId: string,
  body: Record<string, string> | [string, string][],
) {
  const moderator = await createTestUser("moderator");
  const context = new RouterContextProvider();
  context.set(userContext, (await getUserByIdWithRole(moderator.id)) as never);

  const result = await action({
    params: { eventId },
    request: new Request(
      `http://localhost:3000/admin/events/${eventId}/signups`,
      { method: "POST", body: new URLSearchParams(body) },
    ),
    context,
  } as unknown as Parameters<typeof action>[0]);

  return { result, moderator };
}

/** For the intents that answer with data: the payload and its status. */
async function postForData(
  eventId: string,
  body: Record<string, string> | [string, string][],
) {
  const { result, moderator } = await callAction(eventId, body);
  const reply = result as unknown as {
    data: { messageResult?: { sent: string[]; failed: string[] } } & {
      messageError?: string;
    };
    init: ResponseInit | null;
  };
  return { ...reply.data, status: reply.init?.status ?? 200, moderator };
}

function mailsOf(submissionId: string) {
  return prisma.signupMail.findMany({
    where: { submissionId },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });
}

async function post(eventId: string, body: Record<string, string>) {
  const { result, moderator } = await callAction(eventId, body);
  const response = result as Response;

  const { toast } = await getToast(
    new Request("http://localhost:3000", {
      headers: { cookie: response.headers.get("set-cookie") ?? "" },
    }),
  );

  return { response, toast, moderator };
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
    expect(await mailsOf(waiting.id)).toMatchObject([
      { kind: "confirmed", recipient: "ada@example.com" },
    ]);
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

describe("sending a signup's confirmation from the signup sheet", () => {
  it("sends the mail a signup has none of on record, and records who sent it", async () => {
    const { event, signUp } = await createTestEvent(5);
    const signup = await signUp("ada@example.com", [
      { name: "Grace", friend_email: "grace@example.com" },
    ]);

    const { toast, moderator } = await post(event.id, {
      intent: "send-confirmation",
      submissionId: signup.id,
    });

    expect(toast).toMatchObject({
      type: "success",
      title: "Confirmation sent",
    });
    expect(
      sendTemplateMock.mock.calls.map(([template, to, props]) => [
        template,
        to,
        "status" in props ? props.status : null,
      ]),
    ).toEqual([
      ["signupConfirmation", "ada@example.com", "confirmed"],
      ["friendSignup", "grace@example.com", "confirmed"],
    ]);
    expect(await mailsOf(signup.id)).toMatchObject([
      {
        kind: "confirmed",
        recipient: "ada@example.com",
        sentById: moderator.id,
      },
      {
        kind: "friend",
        recipient: "grace@example.com",
        sentById: moderator.id,
      },
    ]);
  });

  it("sends the waiting-list mail to a signup on the waiting list", async () => {
    const { event, signUp } = await createTestEvent(0);
    const waiting = await signUp("ada@example.com");

    const { toast } = await post(event.id, {
      intent: "send-confirmation",
      submissionId: waiting.id,
    });

    expect(toast).toMatchObject({ title: "Waiting-list email sent" });
    expect(sendTemplateMock.mock.calls[0][2]).toMatchObject({
      status: "waitlisted",
    });
    expect(await mailsOf(waiting.id)).toMatchObject([{ kind: "waitlisted" }]);
  });

  it("doesn't send it twice", async () => {
    const { event, signUp } = await createTestEvent(5);
    const signup = await signUp("ada@example.com");
    await post(event.id, {
      intent: "send-confirmation",
      submissionId: signup.id,
    });

    const { toast } = await post(event.id, {
      intent: "send-confirmation",
      submissionId: signup.id,
    });

    expect(toast).toMatchObject({ title: "Already sent" });
    expect(sendTemplateMock).toHaveBeenCalledOnce();
    expect(await mailsOf(signup.id)).toHaveLength(1);
  });

  it("offers the seat confirmation again to a signup that only got the waiting-list mail", async () => {
    const { event, signUp } = await createTestEvent(0);
    const waiting = await signUp("ada@example.com");
    await post(event.id, {
      intent: "send-confirmation",
      submissionId: waiting.id,
    });
    // moved up without going through the sheet, so no seat mail went out
    await updateSignupStatus({
      eventId: event.id,
      submissionId: waiting.id,
      status: "confirmed",
    });

    const { toast } = await post(event.id, {
      intent: "send-confirmation",
      submissionId: waiting.id,
    });

    expect(toast).toMatchObject({ title: "Confirmation sent" });
    expect((await mailsOf(waiting.id)).map((mail) => mail.kind)).toEqual([
      "waitlisted",
      "confirmed",
    ]);
  });

  it("sends nothing to a cancelled signup", async () => {
    const { event, signUp } = await createTestEvent(5);
    const signup = await signUp("ada@example.com");
    await post(event.id, { intent: "cancel", submissionId: signup.id });

    const { toast } = await post(event.id, {
      intent: "send-confirmation",
      submissionId: signup.id,
    });

    expect(toast).toMatchObject({ type: "error" });
    expect(sendTemplateMock).not.toHaveBeenCalled();
  });

  it("records nothing when the mail fails, so it can be sent again", async () => {
    const { event, signUp } = await createTestEvent(5);
    const signup = await signUp("ada@example.com");
    sendTemplateMock.mockRejectedValue(new Error("Resend rejected it"));

    const { toast } = await post(event.id, {
      intent: "send-confirmation",
      submissionId: signup.id,
    });

    expect(toast).toMatchObject({ type: "error", title: "The email failed" });
    expect(await mailsOf(signup.id)).toEqual([]);
  });

  it("won't send for a signup of another event", async () => {
    const { event } = await createTestEvent(5);
    const other = await createTestEvent(5);
    const elsewhere = await other.signUp("ada@example.com");

    await expect(
      post(event.id, {
        intent: "send-confirmation",
        submissionId: elsewhere.id,
      }),
    ).rejects.toMatchObject({ status: 404 });
    expect(sendTemplateMock).not.toHaveBeenCalled();
  });
});

describe("writing to a signup from the signup sheet", () => {
  it("sends each picked guest their own copy, with their name filled in", async () => {
    const { event, signUp } = await createTestEvent(5);
    const signup = await signUp("ada@example.com", [
      { name: "Grace", friend_email: "grace@example.com" },
      { name: "Alan", friend_email: "alan@example.com" },
    ]);

    const reply = await postForData(event.id, [
      ["intent", "message"],
      ["submissionId", signup.id],
      ["recipient", "0"],
      ["recipient", "1"],
      ["subject", "  See you at {event}  "],
      ["message", "Hi {name}, bring a jumper."],
    ]);

    expect(reply.status).toBe(200);
    expect(reply.messageResult).toEqual({ sent: ["ada", "Grace"], failed: [] });
    expect(
      sendTemplateMock.mock.calls.map(([template, to, props, options]) => [
        template,
        to,
        props,
        options,
      ]),
    ).toEqual([
      [
        "signupMessage",
        "ada@example.com",
        {
          subject: `See you at ${event.title}`,
          message: "Hi ada, bring a jumper.",
          event: {
            title: event.title,
            url: `http://localhost:3000/events/${event.id}`,
          },
        },
        {
          from: "moku pona <noreply@mokupona.ch>",
          replyTo: "contact@mokupona.ch",
        },
      ],
      [
        "signupMessage",
        "grace@example.com",
        expect.objectContaining({ message: "Hi Grace, bring a jumper." }),
        expect.anything(),
      ],
    ]);
    expect(await mailsOf(signup.id)).toMatchObject([
      {
        kind: "custom",
        recipient: "ada@example.com",
        subject: `See you at ${event.title}`,
        message: "Hi ada, bring a jumper.",
        sentById: reply.moderator.id,
      },
      { kind: "custom", recipient: "grace@example.com" },
    ]);
  });

  it("says who it couldn't reach and records only the mails that went out", async () => {
    const { event, signUp } = await createTestEvent(5);
    const signup = await signUp("ada@example.com", [
      { name: "Grace", friend_email: "grace@example.com" },
    ]);
    sendTemplateMock.mockImplementation(async (_template, to) => {
      if (to === "grace@example.com") throw new Error("Resend rejected it");
    });

    const reply = await postForData(event.id, [
      ["intent", "message"],
      ["submissionId", signup.id],
      ["recipient", "0"],
      ["recipient", "1"],
      ["subject", "Hello"],
      ["message", "See you soon."],
    ]);

    expect(reply.messageResult).toEqual({ sent: ["ada"], failed: ["Grace"] });
    expect(await mailsOf(signup.id)).toMatchObject([
      { kind: "custom", recipient: "ada@example.com" },
    ]);
  });

  it.each([
    [
      [
        ["subject", "Hi"],
        ["message", "Hello"],
      ],
      /Pick at least one person/,
    ],
    [
      [
        ["recipient", "0"],
        ["subject", " "],
        ["message", "Hello"],
      ],
      /subject/,
    ],
    [
      [
        ["recipient", "0"],
        ["subject", "Hi"],
        ["message", ""],
      ],
      /message/,
    ],
    [
      [
        ["recipient", "0"],
        ["subject", "Hi {nmae}"],
        ["message", "Hello"],
      ],
      /Unknown placeholder \{nmae\}/,
    ],
    // a guest without an address can't be written to
    [
      [
        ["recipient", "7"],
        ["subject", "Hi"],
        ["message", "Hello"],
      ],
      /Pick/,
    ],
  ] as [[string, string][], RegExp][])(
    "sends nothing for an incomplete message (%#)",
    async (fields, error) => {
      const { event, signUp } = await createTestEvent(5);
      const signup = await signUp("ada@example.com");

      const reply = await postForData(event.id, [
        ["intent", "message"],
        ["submissionId", signup.id],
        ...fields,
      ]);

      expect(reply.status).toBe(400);
      expect(reply.messageError).toMatch(error);
      expect(sendTemplateMock).not.toHaveBeenCalled();
    },
  );
});

/** For the bookkeeping intents: what the action answered, and with what status. */
async function postBookkeeping(
  eventId: string,
  body: Record<string, string> | [string, string][],
) {
  const { result } = await callAction(eventId, body);
  const reply = result as unknown as {
    data: { saved?: string; error?: string };
    init: ResponseInit | null;
  };
  return { ...reply.data, status: reply.init?.status ?? 200 };
}

function submissionOf(id: string) {
  return prisma.formSubmission.findUniqueOrThrow({
    where: { id },
    include: { guestBookkeeping: { orderBy: { guestIndex: "asc" } } },
  });
}

describe("bookkeeping on the signup sheet during the dinner", () => {
  it("ticks a person as arrived and back, without touching the others", async () => {
    const { event, signUp } = await createTestEvent(5);
    const signup = await signUp("ada@example.com", ["Grace", "Alan"]);

    const reply = await postBookkeeping(event.id, {
      intent: "arrival",
      submissionId: signup.id,
      guest: "1",
      arrived: "on",
    });

    expect(reply).toMatchObject({ saved: "arrival", status: 200 });
    let { guestBookkeeping } = await submissionOf(signup.id);
    expect(guestBookkeeping).toHaveLength(1);
    expect(guestBookkeeping[0].guestIndex).toBe(1);
    expect(guestBookkeeping[0].arrivedAt).toBeInstanceOf(Date);

    await postBookkeeping(event.id, {
      intent: "arrival",
      submissionId: signup.id,
      guest: "1",
    });
    ({ guestBookkeeping } = await submissionOf(signup.id));
    expect(guestBookkeeping[0].arrivedAt).toBeNull();
  });

  it("notes a person's donation and how they gave it", async () => {
    const { event, signUp } = await createTestEvent(5);
    const signup = await signUp("ada@example.com", ["Grace"]);

    const reply = await postBookkeeping(event.id, {
      intent: "donation",
      submissionId: signup.id,
      guest: "0",
      amount: "7,50",
      method: "cash",
    });

    expect(reply).toMatchObject({ saved: "donation", status: 200 });
    expect((await submissionOf(signup.id)).guestBookkeeping).toMatchObject([
      { guestIndex: 0, donationRappen: 750, donationMethod: "cash" },
    ]);

    // an emptied field takes the donation back out
    await postBookkeeping(event.id, {
      intent: "donation",
      submissionId: signup.id,
      guest: "0",
      amount: "",
      method: "cash",
    });
    expect((await submissionOf(signup.id)).guestBookkeeping).toMatchObject([
      { donationRappen: null },
    ]);
  });

  it("refuses a donation that isn't an amount, and a person beyond the party", async () => {
    const { event, signUp } = await createTestEvent(5);
    const signup = await signUp("ada@example.com");

    const reply = await postBookkeeping(event.id, {
      intent: "donation",
      submissionId: signup.id,
      guest: "0",
      amount: "ten",
      method: "twint",
    });
    expect(reply.status).toBe(400);
    expect(reply.error).toMatch(/amount in francs/);

    await expect(
      postBookkeeping(event.id, {
        intent: "arrival",
        submissionId: signup.id,
        guest: "1",
        arrived: "on",
      }),
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      postBookkeeping(event.id, {
        intent: "donation",
        submissionId: signup.id,
        guest: "0",
        amount: "5",
        method: "cheque",
      }),
    ).rejects.toMatchObject({ status: 400 });
    expect((await submissionOf(signup.id)).guestBookkeeping).toEqual([]);
  });

  it("keeps how each half came in alongside the ticks", async () => {
    const { event, signUp } = await createTestEvent(5);
    const signup = await signUp("ada@example.com");

    await postBookkeeping(event.id, {
      intent: "payments",
      submissionId: signup.id,
      firstHalfPaid: "on",
      firstHalfMethod: "cash",
      secondHalfMethod: "twint",
    });

    expect(await submissionOf(signup.id)).toMatchObject({
      firstHalfPaid: true,
      firstHalfMethod: "cash",
      secondHalfPaid: false,
      secondHalfMethod: "twint",
    });
  });

  it("ticks the payment reminder", async () => {
    const { event, signUp } = await createTestEvent(5);
    const signup = await signUp("ada@example.com");

    await postBookkeeping(event.id, {
      intent: "reminder",
      submissionId: signup.id,
      paymentReminderSent: "on",
    });

    expect((await submissionOf(signup.id)).paymentReminderSent).toBe(true);
  });

  it("sets the event's TWINT fees, and refuses fees that aren't numbers", async () => {
    const { event } = await createTestEvent(5);

    const saved = await postBookkeeping(event.id, {
      intent: "twint-fees",
      percent: "1,3",
      fixed: "0.25",
    });
    expect(saved).toMatchObject({ saved: "twint-fees", status: 200 });
    expect(
      await prisma.event.findUniqueOrThrow({ where: { id: event.id } }),
    ).toMatchObject({ twintFeePercent: 1.3, twintFeeFixedRappen: 25 });

    const refused = await postBookkeeping(event.id, {
      intent: "twint-fees",
      percent: "",
      fixed: "0.25",
    });
    expect(refused.status).toBe(400);
    expect(
      (await prisma.event.findUniqueOrThrow({ where: { id: event.id } }))
        .twintFeePercent,
    ).toBe(1.3);
  });
});

describe("ticking the confirmation by hand", () => {
  it("counts a confirmation ticked by hand as sent, and won't send it again", async () => {
    const { event, signUp } = await createTestEvent(5);
    const signup = await signUp("ada@example.com");

    await postBookkeeping(event.id, {
      intent: "confirmation-mark",
      submissionId: signup.id,
      sent: "on",
    });
    expect((await submissionOf(signup.id)).confirmationMarkedSent).toBe(true);

    const { toast } = await post(event.id, {
      intent: "send-confirmation",
      submissionId: signup.id,
    });
    expect(toast).toMatchObject({ title: "Already marked as sent" });
    expect(sendTemplateMock).not.toHaveBeenCalled();
  });

  it("sends a confirmation ticked as not sent again, and lets the record speak after", async () => {
    const { event, signUp } = await createTestEvent(5);
    const signup = await signUp("ada@example.com");
    await prisma.signupMail.create({
      data: {
        submissionId: signup.id,
        kind: "confirmed",
        recipient: "ada@example.com",
      },
    });

    // unticked: it never arrived
    await postBookkeeping(event.id, {
      intent: "confirmation-mark",
      submissionId: signup.id,
    });
    expect((await submissionOf(signup.id)).confirmationMarkedSent).toBe(false);

    const { toast } = await post(event.id, {
      intent: "send-confirmation",
      submissionId: signup.id,
    });

    expect(toast).toMatchObject({
      type: "success",
      title: "Confirmation sent",
    });
    expect(sendTemplateMock).toHaveBeenCalledOnce();
    expect((await submissionOf(signup.id)).confirmationMarkedSent).toBeNull();
  });
});
