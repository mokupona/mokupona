// @vitest-environment node
import { RouterContextProvider } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { buildEventData } from "../../../test/factories";

import { prisma } from "~/db.server";
import { optionalUserContext } from "~/features/auth/middleware.server";
import {
  HONEYPOT_FIELD_NAME,
  HONEYPOT_VALID_FROM_FIELD_NAME,
} from "~/features/forms/honeypot";
import { getHoneypotInputProps } from "~/features/forms/honeypot.server";
import { sendTemplate } from "~/features/mail/mail.server";
import { defaultText } from "~/features/site-text/text";
import { createEvent } from "~/models/event.server";
import { getCurrentFormVersion } from "~/models/form.server";
import { action } from "~/routes/events_.$eventId";

vi.mock("~/features/mail/mail.server", () => ({ sendTemplate: vi.fn() }));
const sendTemplateMock = vi.mocked(sendTemplate);

beforeEach(() => {
  sendTemplateMock.mockReset();
  sendTemplateMock.mockResolvedValue();
});

async function createTestEvent(
  overrides: Partial<Parameters<typeof createEvent>[0]> = {},
) {
  const event = await createEvent({
    ...(await buildEventData()),
    ...overrides,
  });
  const version = await getCurrentFormVersion(event.formId);

  return { eventId: event.id, versionId: version.id };
}

// every browser submission carries the spam-trap fields — with the trap
// itself left blank — so tests of the rest of the action must too
function fromBrowser(body: Record<string, string> = {}) {
  return {
    [HONEYPOT_FIELD_NAME]: "",
    [HONEYPOT_VALID_FROM_FIELD_NAME]: getHoneypotInputProps().validFrom,
    ...body,
  };
}

function answers(versionId: string) {
  return {
    formVersionId: versionId,
    name: "Ada Signer",
    email: "ada@example.com",
    phone: "0791234567",
    acceptedPrivacy: "on",
  };
}

/** What the root middleware gives every request: here, a guest. */
function guestContext() {
  const context = new RouterContextProvider();
  context.set(optionalUserContext, async () => null);
  return context;
}

function submit(
  eventId: string,
  body: Record<string, string>,
  headers?: HeadersInit,
) {
  return action({
    params: { eventId },
    request: new Request(`http://localhost:3000/events/${eventId}`, {
      method: "POST",
      body: new URLSearchParams(body),
      headers,
    }),
    context: guestContext(),
  } as unknown as Parameters<typeof action>[0]);
}

function storedFor(formVersionId: string) {
  return prisma.formSubmission.findMany({ where: { formVersionId } });
}

function expectSuccessRedirect(result: Awaited<ReturnType<typeof action>>) {
  expect(result).toBeInstanceOf(Response);
  const response = result as Response;
  expect(response.status).toBe(302);
  expect(response.headers.get("location")).toBe("/events");
}

function readFormErrors(result: Awaited<ReturnType<typeof action>>) {
  const reply = result as { error?: Record<string, string[] | null> | null };
  return reply.error?.[""] ?? [];
}

describe("event signup action", () => {
  it("stores a submission carrying a freshly minted stamp", async () => {
    const { eventId, versionId } = await createTestEvent();

    expectSuccessRedirect(
      await submit(eventId, fromBrowser(answers(versionId))),
    );

    const stored = await storedFor(versionId);
    expect(stored).toHaveLength(1);
    expect(stored[0].answers).toMatchObject({
      name: "Ada Signer",
      email: "ada@example.com",
    });
  });

  it("mails the signer a summary of the signup from the event sender", async () => {
    const { eventId, versionId } = await createTestEvent({
      title: "Winter table",
      price: 45,
      studentPrice: 30,
      confirmedMailSubject: "See you at {event}",
    });

    expectSuccessRedirect(
      await submit(
        eventId,
        fromBrowser({
          ...answers(versionId),
          student: "on",
          "friends[0].name": "Grace Friend",
          "friends[0].vegetarian": "on",
        }),
      ),
    );

    expect(sendTemplateMock).toHaveBeenCalledOnce();
    const [template, to, props, options] = sendTemplateMock.mock.calls[0];
    expect(template).toBe("signupConfirmation");
    expect(to).toBe("ada@example.com");
    expect(options).toEqual({ from: "moku pona <noreply@mokupona.ch>" });
    expect(props).toMatchObject({
      status: "confirmed",
      event: {
        title: "Winter table",
        url: `http://localhost:3000/events/${eventId}`,
        mailSubject: "See you at {event}",
        mailMessage: null,
      },
      booking: {
        guests: [
          { name: "Ada Signer", isStudent: true, price: 30 },
          { name: "Grace Friend", isStudent: false, price: 45 },
        ],
        total: 75,
      },
    });
  });

  it("mails each friend who gave an address once, and never the signer", async () => {
    const { eventId, versionId } = await createTestEvent({
      title: "Winter table",
    });

    expectSuccessRedirect(
      await submit(
        eventId,
        fromBrowser({
          ...answers(versionId),
          "friends[0].name": "Grace Friend",
          "friends[0].friend_email": "grace@example.com",
          "friends[1].name": "Alan Friend",
          "friends[1].friend_email": "GRACE@example.com",
          "friends[2].name": "Ada again",
          "friends[2].friend_email": "ada@example.com",
        }),
      ),
    );

    expect(
      sendTemplateMock.mock.calls.map(([template, to]) => [template, to]),
    ).toEqual([
      ["signupConfirmation", "ada@example.com"],
      ["friendSignup", "grace@example.com"],
    ]);
    expect(sendTemplateMock.mock.calls[1][2]).toMatchObject({
      status: "confirmed",
      signer: "Ada Signer",
      event: { title: "Winter table" },
      guest: { name: "Grace Friend", email: "grace@example.com" },
    });
  });

  it("waitlists a party that doesn't fit and mails the waiting-list copy", async () => {
    const { eventId, versionId } = await createTestEvent({
      slots: 1,
      waitlistMailSubject: "Hang tight for {event}",
    });

    expectSuccessRedirect(
      await submit(
        eventId,
        fromBrowser({
          ...answers(versionId),
          "friends[0].name": "Grace Friend",
        }),
      ),
    );

    const stored = await storedFor(versionId);
    expect(stored).toMatchObject([
      { status: "waitlisted", seats: 2, email: "ada@example.com" },
    ]);
    expect(sendTemplateMock.mock.calls[0][2]).toMatchObject({
      status: "waitlisted",
      event: { mailSubject: "Hang tight for {event}" },
    });
  });

  it("turns away a second signup from the same email with a form error", async () => {
    const { eventId, versionId } = await createTestEvent();
    await submit(eventId, fromBrowser(answers(versionId)));

    const result = await submit(
      eventId,
      fromBrowser({ ...answers(versionId), email: "ADA@example.com" }),
    );

    expect(readFormErrors(result)).toEqual([
      expect.stringMatching(/already signed up for this event/),
    ]);
    expect(await storedFor(versionId)).toHaveLength(1);
    expect(sendTemplateMock).toHaveBeenCalledOnce();
  });

  it("keeps the signup when the confirmation mail fails", async () => {
    const { eventId, versionId } = await createTestEvent();
    sendTemplateMock.mockRejectedValue(
      new Error("Resend rejected the message"),
    );

    expectSuccessRedirect(
      await submit(eventId, fromBrowser(answers(versionId))),
    );
    expect(await storedFor(versionId)).toHaveLength(1);
  });

  it("answers a filled spam trap with the success redirect", async () => {
    const { eventId, versionId } = await createTestEvent();

    const result = await submit(eventId, {
      ...fromBrowser(answers(versionId)),
      [HONEYPOT_FIELD_NAME]: "https://buy-cheap-pills.example",
    });

    // indistinguishable from the real thing, and nothing was written or sent
    expectSuccessRedirect(result);
    expect(await storedFor(versionId)).toHaveLength(0);
    expect(sendTemplateMock).not.toHaveBeenCalled();
  });

  it("answers a filled spam trap the same way when nothing else validates", async () => {
    const { eventId, versionId } = await createTestEvent();

    // the trap is read before the answers are, so a bot cannot tell a
    // rejected payload apart from an accepted one
    const result = await submit(eventId, {
      [HONEYPOT_FIELD_NAME]: "https://buy-cheap-pills.example",
    });

    expectSuccessRedirect(result);
    expect(await storedFor(versionId)).toHaveLength(0);
  });

  it("asks for a retry when the stamp cannot be verified", async () => {
    const { eventId, versionId } = await createTestEvent();

    // what a tab that outlived a deploy sends: an empty trap, a stamp this
    // process cannot vouch for. A person, so the answers must come back on
    // screen instead of vanishing into the fake success.
    const result = await submit(eventId, {
      ...fromBrowser(answers(versionId)),
      [HONEYPOT_VALID_FROM_FIELD_NAME]: `${Date.now()}.stale-signature`,
    });

    expect(readFormErrors(result)).toEqual([defaultText("site.forms.retry")]);
    expect(await storedFor(versionId)).toHaveLength(0);
  });

  describe("statistics", () => {
    const browser = {
      "User-Agent":
        "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
    };

    afterEach(async () => {
      await prisma.statHit.deleteMany();
    });

    function signupHits(eventId: string) {
      return prisma.statHit.findMany({ where: { eventId, kind: "signup" } });
    }

    it("counts a stored signup as the last step of the event's funnel", async () => {
      const { eventId, versionId } = await createTestEvent();

      expectSuccessRedirect(
        await submit(eventId, fromBrowser(answers(versionId)), browser),
      );

      const [hit, ...rest] = await signupHits(eventId);
      expect(rest).toHaveLength(0);
      expect(hit).toMatchObject({
        path: `/events/${eventId}`,
        detail: "confirmed",
      });
    });

    it("leaves out a signup from a browser the team uses", async () => {
      const { eventId, versionId } = await createTestEvent();

      expectSuccessRedirect(
        await submit(eventId, fromBrowser(answers(versionId)), {
          ...browser,
          Cookie: "stats_exclude=1",
        }),
      );

      expect(await signupHits(eventId)).toHaveLength(0);
    });

    it("counts nothing for a rejected signup", async () => {
      const { eventId } = await createTestEvent();

      await submit(eventId, fromBrowser({ formVersionId: "stale" }), browser);

      expect(await signupHits(eventId)).toHaveLength(0);
    });
  });
});
