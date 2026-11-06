import { describe, expect, it } from "vitest";

import {
  confirmationMailState,
  messageRecipients,
  toSentSignupMail,
  type SentSignupMail,
} from "./signup-mails";

function sent(
  kind: SentSignupMail["kind"],
  sentAt: string,
  recipient = "ada@example.com",
): SentSignupMail {
  return {
    kind,
    recipient,
    subject: "",
    message: "",
    sentAt: new Date(sentAt),
    sentBy: null,
  };
}

describe("confirmationMailState", () => {
  it("is sent once the mail for the signup's status went out", () => {
    expect(
      confirmationMailState({
        status: "confirmed",
        mailsTracked: true,
        mails: [sent("confirmed", "2026-11-05T10:00:00Z")],
      }),
    ).toEqual({
      kind: "sent",
      mail: "confirmed",
      sentAt: new Date("2026-11-05T10:00:00Z"),
    });
  });

  it("is due when nothing is on record, saying whether anyone kept track", () => {
    expect(
      confirmationMailState({
        status: "waitlisted",
        mailsTracked: true,
        mails: [],
      }),
    ).toEqual({
      kind: "due",
      mail: "waitlisted",
      previous: null,
      tracked: true,
      markedNotSent: false,
    });
    expect(
      confirmationMailState({
        status: "confirmed",
        mailsTracked: false,
        mails: [],
      }),
    ).toMatchObject({ kind: "due", tracked: false });
  });

  it("doesn't count friends' notes or admins' messages as the confirmation", () => {
    expect(
      confirmationMailState({
        status: "confirmed",
        mailsTracked: true,
        mails: [
          sent("friend", "2026-11-05T10:00:00Z", "grace@example.com"),
          sent("custom", "2026-11-05T11:00:00Z"),
        ],
      }),
    ).toMatchObject({ kind: "due", mail: "confirmed", previous: null });
  });

  it("is due again when the last signup mail was written for another status", () => {
    expect(
      confirmationMailState({
        status: "confirmed",
        mailsTracked: true,
        mails: [sent("waitlisted", "2026-11-05T10:00:00Z")],
      }),
    ).toEqual({
      kind: "due",
      mail: "confirmed",
      previous: {
        mail: "waitlisted",
        sentAt: new Date("2026-11-05T10:00:00Z"),
      },
      tracked: true,
      markedNotSent: false,
    });
  });

  it("goes by the latest signup mail", () => {
    expect(
      confirmationMailState({
        status: "confirmed",
        mailsTracked: true,
        mails: [
          sent("waitlisted", "2026-11-04T10:00:00Z"),
          sent("confirmed", "2026-11-05T10:00:00Z"),
        ],
      }),
    ).toMatchObject({ kind: "sent", mail: "confirmed" });
  });

  it("counts a mail an admin marked as sent by hand", () => {
    expect(
      confirmationMailState({
        status: "confirmed",
        mailsTracked: false,
        mails: [],
        markedSent: true,
      }),
    ).toEqual({ kind: "marked", mail: "confirmed" });
    // the record still shows when the site did send it
    expect(
      confirmationMailState({
        status: "confirmed",
        mailsTracked: true,
        mails: [sent("confirmed", "2026-11-05T10:00:00Z")],
        markedSent: true,
      }),
    ).toMatchObject({ kind: "sent", mail: "confirmed" });
  });

  it("is due when an admin marked it as not sent, whatever the records say", () => {
    expect(
      confirmationMailState({
        status: "confirmed",
        mailsTracked: true,
        mails: [sent("confirmed", "2026-11-05T10:00:00Z")],
        markedSent: false,
      }),
    ).toEqual({
      kind: "due",
      mail: "confirmed",
      previous: null,
      tracked: true,
      markedNotSent: true,
    });
  });

  it("has nothing due for a cancelled signup", () => {
    expect(
      confirmationMailState({
        status: "cancelled",
        mailsTracked: true,
        mails: [sent("confirmed", "2026-11-05T10:00:00Z")],
      }),
    ).toEqual({
      kind: "none",
      last: { mail: "confirmed", sentAt: new Date("2026-11-05T10:00:00Z") },
    });
    expect(
      confirmationMailState({
        status: "cancelled",
        mailsTracked: true,
        mails: [],
        markedSent: true,
      }),
    ).toEqual({ kind: "none", last: null });
  });
});

describe("messageRecipients", () => {
  it("lists the signer and each friend with an address, each address once", () => {
    expect(
      messageRecipients(
        [
          { name: "Ada", email: null },
          { name: "Grace", email: "grace@example.com" },
          { name: "Alan", email: null },
          { name: "Grace again", email: " GRACE@example.com " },
          { name: "Ada's twin", email: "ada@example.com" },
        ],
        "ada@example.com",
      ),
    ).toEqual([
      { guestIndex: 0, name: "Ada", email: "ada@example.com" },
      { guestIndex: 1, name: "Grace", email: "grace@example.com" },
    ]);
  });

  it("leaves out a signer without an address", () => {
    expect(messageRecipients([{ name: "Ada", email: null }], " ")).toEqual([]);
  });
});

describe("toSentSignupMail", () => {
  it("leaves out a kind this code doesn't know", () => {
    const row = {
      recipient: "ada@example.com",
      subject: "",
      message: "",
      createdAt: new Date("2026-11-05T10:00:00Z"),
      sentBy: { name: "Moderator" },
    };

    expect(toSentSignupMail({ ...row, kind: "reminder" })).toEqual([]);
    expect(toSentSignupMail({ ...row, kind: "custom" })).toEqual([
      {
        kind: "custom",
        recipient: "ada@example.com",
        subject: "",
        message: "",
        sentAt: row.createdAt,
        sentBy: "Moderator",
      },
    ]);
  });
});
