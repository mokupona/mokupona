import { describe, expect, it } from "vitest";

import {
  everyoneMailRecipients,
  type EveryoneMailParty,
} from "./everyone-mail";

function party(
  submissionId: string,
  overrides: Partial<EveryoneMailParty> & {
    guests?: { name: string; email: string | null }[];
    cancelled?: number[];
  } = {},
): EveryoneMailParty {
  const {
    guests = [{ name: submissionId, email: null }],
    cancelled = [],
    ...rest
  } = overrides;
  return {
    submissionId,
    status: "confirmed",
    isLegacy: false,
    signerEmail: `${submissionId}@example.com`,
    booking: { guests },
    guestBookkeeping: guests.map((_, guestIndex) => ({
      cancelledAt: cancelled.includes(guestIndex) ? new Date() : null,
    })),
    ...rest,
  };
}

const BOTH = ["confirmed", "waitlisted"] as const;

describe("everyoneMailRecipients", () => {
  it("writes to each signer and every friend who gave an address", () => {
    const recipients = everyoneMailRecipients(
      [
        party("ada", {
          guests: [
            { name: "Ada", email: null },
            { name: "Grace", email: "grace@example.com" },
            { name: "Alan", email: null },
          ],
        }),
        party("emmy", { status: "waitlisted" }),
      ],
      BOTH,
    );

    expect(recipients).toEqual([
      {
        submissionId: "ada",
        status: "confirmed",
        guestIndex: 0,
        name: "Ada",
        email: "ada@example.com",
      },
      {
        submissionId: "ada",
        status: "confirmed",
        guestIndex: 1,
        name: "Grace",
        email: "grace@example.com",
      },
      {
        submissionId: "emmy",
        status: "waitlisted",
        guestIndex: 0,
        name: "emmy",
        email: "emmy@example.com",
      },
    ]);
  });

  it("leaves out cancelled groups and anyone cancelled on their own", () => {
    const recipients = everyoneMailRecipients(
      [
        party("gone", { status: "cancelled" }),
        party("ada", {
          guests: [
            { name: "Ada", email: null },
            { name: "Grace", email: "grace@example.com" },
          ],
          cancelled: [1],
        }),
        // the signer dropped out, their friend still comes
        party("alan", {
          guests: [
            { name: "Alan", email: null },
            { name: "Hedy", email: "hedy@example.com" },
          ],
          cancelled: [0],
        }),
      ],
      BOTH,
    );

    expect(recipients.map((recipient) => recipient.email)).toEqual([
      "ada@example.com",
      "hedy@example.com",
    ]);
  });

  it("writes only to the statuses picked", () => {
    const parties = [
      party("seated"),
      party("waiting", { status: "waitlisted" }),
    ];

    expect(
      everyoneMailRecipients(parties, ["confirmed"]).map((r) => r.name),
    ).toEqual(["seated"]);
    expect(
      everyoneMailRecipients(parties, ["waitlisted"]).map((r) => r.name),
    ).toEqual(["waiting"]);
    expect(everyoneMailRecipients(parties, [])).toEqual([]);
  });

  it("sends one mail to an address listed twice, for the first of them", () => {
    const recipients = everyoneMailRecipients(
      [
        party("ada", {
          guests: [
            { name: "Ada", email: null },
            { name: "Ada again", email: "ADA@example.com" },
            { name: "Grace", email: "grace@example.com" },
          ],
        }),
        party("grace", { signerEmail: " Grace@Example.com " }),
      ],
      BOTH,
    );

    expect(recipients.map((recipient) => recipient.name)).toEqual([
      "Ada",
      "Grace",
    ]);
  });

  it("writes to a later one when the first with that address is cancelled", () => {
    const recipients = everyoneMailRecipients(
      [
        party("ada", {
          guests: [
            { name: "Ada", email: null },
            { name: "Grace", email: "grace@example.com" },
          ],
          cancelled: [1],
        }),
        party("grace", { signerEmail: "grace@example.com" }),
      ],
      BOTH,
    );

    expect(recipients).toMatchObject([
      { name: "Ada" },
      { submissionId: "grace", email: "grace@example.com" },
    ]);
  });

  it("leaves out signups from before signup forms and signers without an address", () => {
    expect(
      everyoneMailRecipients(
        [
          party("legacy", { isLegacy: true }),
          party("blank", { signerEmail: " " }),
        ],
        BOTH,
      ),
    ).toEqual([]);
  });
});
