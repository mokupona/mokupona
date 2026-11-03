// @vitest-environment node

import { describe, expect, it } from "vitest";

import { buildEventData } from "../../../test/factories";

import { getSignupBookingsForEvent } from "./bookings.server";

import { prisma } from "~/db.server";
import { defaultText } from "~/features/site-text/text";
import { createEvent } from "~/models/event.server";
import { getCurrentFormVersion } from "~/models/form.server";

async function eventWithPrices() {
  const event = await createEvent({
    ...(await buildEventData()),
    price: 45,
    studentPrice: 30,
  });
  const version = await getCurrentFormVersion(event.formId);
  return { eventId: event.id, versionId: version.id };
}

describe("getSignupBookingsForEvent", () => {
  it("prices a current signup the way its confirmation mail does", async () => {
    const { eventId, versionId } = await eventWithPrices();
    await prisma.formSubmission.create({
      data: {
        formVersionId: versionId,
        status: "waitlisted",
        seats: 2,
        email: "ada@example.com",
        answers: {
          name: "Ada",
          email: "ada@example.com",
          phone: "0791234567",
          vegetarian: false,
          student: true,
          restrictions: "",
          comment: "",
          friends: [
            {
              name: "Grace",
              vegetarian: true,
              student: false,
              restrictions: "",
              friend_email: "grace@example.com",
            },
          ],
        },
      },
    });

    const [signup] = await getSignupBookingsForEvent(
      eventId,
      { price: 45, studentPrice: 30 },
      defaultText,
    );

    expect(signup).toMatchObject({
      status: "waitlisted",
      isLegacy: false,
      signerEmail: "ada@example.com",
      booking: {
        total: 75,
        guests: [
          { name: "Ada", isStudent: true, price: 30, email: null },
          {
            name: "Grace",
            isStudent: false,
            price: 45,
            email: "grace@example.com",
          },
        ],
      },
    });
  });

  it("reads a signup from before forms as one guest, confirmed", async () => {
    const { eventId } = await eventWithPrices();
    await prisma.eventResponse.create({
      data: {
        eventId,
        name: "Old Guest",
        email: "old@example.com",
        phone: "0791111111",
        vegetarian: true,
        student: true,
      },
    });

    const [signup] = await getSignupBookingsForEvent(
      eventId,
      { price: 45, studentPrice: 30 },
      defaultText,
    );

    expect(signup).toMatchObject({
      status: "confirmed",
      isLegacy: true,
      signerEmail: "old@example.com",
      booking: {
        total: 30,
        guests: [{ name: "Old Guest", isStudent: true, price: 30 }],
        contact: expect.arrayContaining([["Email", "old@example.com"]]),
      },
    });
  });
});
