// @vitest-environment node

import { RouterContextProvider } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { VOLUNTEER_INBOX } from "./schema";

import {
  HONEYPOT_FIELD_NAME,
  HONEYPOT_VALID_FROM_FIELD_NAME,
} from "~/features/forms/honeypot";
import { getHoneypotInputProps } from "~/features/forms/honeypot.server";
import { sendTemplate } from "~/features/mail/mail.server";
import { getText } from "~/features/site-text/site-text.server";
import { createBoardMember } from "~/models/board-member.server";
import { createVolunteer } from "~/models/volunteer.server";
import { action, loader } from "~/routes/about";

vi.mock("~/features/mail/mail.server", () => ({
  sendTemplate: vi.fn(),
}));

const sendTemplateMock = vi.mocked(sendTemplate);

function fromBrowser(body: Record<string, string> = {}) {
  return {
    [HONEYPOT_FIELD_NAME]: "",
    [HONEYPOT_VALID_FROM_FIELD_NAME]: getHoneypotInputProps().validFrom,
    ...body,
  };
}

async function submit(body: Record<string, string>) {
  const result = await action({
    request: new Request("http://localhost/about", {
      method: "POST",
      body: new URLSearchParams(body),
    }),
    params: {},
    context: new RouterContextProvider(),
    unstable_pattern: "/about",
  } as unknown as Parameters<typeof action>[0]);

  // conform replies come back wrapped in data(); success is a plain object
  return result && typeof result === "object" && "data" in result
    ? (result as { data: unknown; init: ResponseInit | null })
    : { data: result, init: null };
}

beforeEach(() => {
  sendTemplateMock.mockReset();
});

describe("about page volunteer sign-up", () => {
  it("emails the contact inbox with the visitor as reply-to", async () => {
    const result = await submit(
      fromBrowser({
        name: "lena huber",
        email: "lena@example.com",
        message: "I make a mean dal",
      }),
    );

    expect(result.data).toEqual({ status: "sent" });
    expect(sendTemplateMock).toHaveBeenCalledWith(
      "volunteerInterest",
      VOLUNTEER_INBOX,
      {
        name: "lena huber",
        email: "lena@example.com",
        message: "I make a mean dal",
      },
      { replyTo: "lena@example.com" },
    );
  });

  it("rejects a missing email without sending", async () => {
    const result = await submit(fromBrowser({ name: "lena huber" }));

    expect(result.init?.status).toBe(400);
    expect(sendTemplateMock).not.toHaveBeenCalled();
  });

  it("pretends to succeed for a bot that fills the trap", async () => {
    const result = await submit(
      fromBrowser({
        name: "bot",
        email: "bot@example.com",
        [HONEYPOT_FIELD_NAME]: "https://spam.example",
      }),
    );

    expect(result.data).toEqual({ status: "sent" });
    expect(sendTemplateMock).not.toHaveBeenCalled();
  });

  it("asks for a retry when the spam-trap stamp is missing", async () => {
    const result = await submit({
      name: "lena huber",
      email: "lena@example.com",
    });

    expect(result.init?.status).toBe(400);
    expect(JSON.stringify(result.data)).toContain(
      (await getText())("site.forms.retry"),
    );
    expect(sendTemplateMock).not.toHaveBeenCalled();
  });

  it("surfaces a send failure instead of claiming success", async () => {
    sendTemplateMock.mockRejectedValueOnce(new Error("resend down"));

    const result = await submit(
      fromBrowser({ name: "lena huber", email: "lena@example.com" }),
    );

    expect(result.init?.status).toBe(500);
    expect(JSON.stringify(result.data)).toContain(VOLUNTEER_INBOX);
  });
});

describe("about page people", () => {
  it("shows board members' and volunteers' bios from their Markdown", async () => {
    const board = await createBoardMember({
      name: `Board ${crypto.randomUUID()}`,
      position: "President",
      bio: "Runs the **kitchen**.",
    });
    const volunteer = await createVolunteer({
      name: `Volunteer ${crypto.randomUUID()}`,
      role: "host",
      bio: "- greets guests\n- pours wine",
    });

    const { boardMembers, volunteers } = await loader();

    expect(boardMembers.find((person) => person.id === board.id)).toMatchObject(
      {
        subtitle: "President",
        bioHtml: "<p>Runs the <strong>kitchen</strong>.</p>",
      },
    );
    expect(
      volunteers.find((person) => person.id === volunteer.id)?.bioHtml,
    ).toBe("<ul>\n<li>greets guests</li>\n<li>pours wine</li>\n</ul>");
  });
});
