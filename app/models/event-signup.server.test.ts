import { describe, expect, it } from "vitest";

import { buildEventData } from "../../test/factories";

import {
  createEventSignup,
  DuplicateSignupError,
  getSeatCounts,
  getSeatCountsByEvent,
  SignupNotFoundError,
  updateSignupStatus,
} from "./event-signup.server";
import { createEvent } from "./event.server";
import { FormVersionChangedError } from "./form-submission.server";
import { getCurrentFormVersion } from "./form.server";

import { prisma } from "~/db.server";

async function createTestEvent(slots: number) {
  const event = await createEvent({ ...(await buildEventData()), slots });
  const version = await getCurrentFormVersion(event.formId);
  return { event, version };
}

type TestEvent = Awaited<ReturnType<typeof createTestEvent>>;

let emailCounter = 0;

function signUp(
  { event, version }: TestEvent,
  { friends = 0, email }: { friends?: number; email?: string } = {},
) {
  const address = email ?? `guest-${++emailCounter}@example.com`;
  return createEventSignup({
    eventId: event.id,
    formVersionId: version.id,
    expectedVersionUpdatedAt: version.updatedAt,
    email: address,
    answers: {
      name: "Guest",
      email: address,
      phone: "0791234567",
      friends: Array.from({ length: friends }, (_, index) => ({
        name: `Friend ${index + 1}`,
      })),
    },
  });
}

describe("createEventSignup", () => {
  it("confirms parties while the whole party fits, up to a full event", async () => {
    const testEvent = await createTestEvent(3);

    expect(await signUp(testEvent, { friends: 1 })).toMatchObject({
      status: "confirmed",
      seats: 2,
    });
    expect(await signUp(testEvent)).toMatchObject({
      status: "confirmed",
      seats: 1,
    });
    expect(await getSeatCounts(testEvent.event.id)).toEqual({
      confirmed: 3,
      waitlisted: 0,
    });
  });

  it("waitlists a party that doesn't fit, as a whole", async () => {
    const testEvent = await createTestEvent(3);
    await signUp(testEvent, { friends: 1 });

    // 1 seat left, 2 people: neither of them gets in
    expect(await signUp(testEvent, { friends: 1 })).toMatchObject({
      status: "waitlisted",
      seats: 2,
    });
    expect(await getSeatCounts(testEvent.event.id)).toEqual({
      confirmed: 2,
      waitlisted: 2,
    });
  });

  it("confirms a later party that fits while a bigger one waits", async () => {
    const testEvent = await createTestEvent(3);
    await signUp(testEvent, { friends: 1 });
    await signUp(testEvent, { friends: 1 }); // waits for 2 seats

    expect((await signUp(testEvent)).status).toBe("confirmed");
    expect((await signUp(testEvent)).status).toBe("waitlisted");
  });

  it("waitlists a party bigger than the whole event, and everyone at 0 seats", async () => {
    const small = await createTestEvent(2);
    expect((await signUp(small, { friends: 2 })).status).toBe("waitlisted");
    // the big party took nothing, so a pair still fits
    expect((await signUp(small, { friends: 1 })).status).toBe("confirmed");

    const closed = await createTestEvent(0);
    expect((await signUp(closed)).status).toBe("waitlisted");
  });

  it("counts seats from signups made before signup forms", async () => {
    const testEvent = await createTestEvent(2);
    await prisma.eventResponse.create({
      data: { eventId: testEvent.event.id, name: "Old", email: "o@x.ch" },
    });

    expect((await signUp(testEvent, { friends: 1 })).status).toBe("waitlisted");
    expect((await signUp(testEvent)).status).toBe("confirmed");
  });

  it("refuses a second signup from the same email, whatever its case", async () => {
    const testEvent = await createTestEvent(1);
    await signUp(testEvent, { email: "Ada@Example.com" });

    await expect(
      signUp(testEvent, { email: " ada@example.COM " }),
    ).rejects.toBeInstanceOf(DuplicateSignupError);
  });

  it("refuses a second signup while the first one waits", async () => {
    const testEvent = await createTestEvent(0);
    await signUp(testEvent, { email: "ada@example.com" });

    await expect(
      signUp(testEvent, { email: "ada@example.com" }),
    ).rejects.toBeInstanceOf(DuplicateSignupError);
  });

  it("lets an email sign up again once its signup is cancelled", async () => {
    const testEvent = await createTestEvent(1);
    const first = await signUp(testEvent, { email: "ada@example.com" });
    await updateSignupStatus({
      eventId: testEvent.event.id,
      submissionId: first.id,
      status: "cancelled",
    });

    // the cancelled signup gave its seat back, too
    expect((await signUp(testEvent, { email: "ada@example.com" })).status).toBe(
      "confirmed",
    );
  });

  it("lets the same email sign up for another event", async () => {
    await signUp(await createTestEvent(1), { email: "ada@example.com" });

    expect(
      (await signUp(await createTestEvent(1), { email: "ada@example.com" }))
        .status,
    ).toBe("confirmed");
  });

  it("still refuses answers given against an outdated form version", async () => {
    const testEvent = await createTestEvent(5);
    await prisma.formVersion.update({
      where: { id: testEvent.version.id },
      data: { updatedAt: new Date(Date.now() + 60_000) },
    });

    await expect(signUp(testEvent)).rejects.toBeInstanceOf(
      FormVersionChangedError,
    );
  });
});

describe("createEventSignup under concurrent signups", () => {
  it("never overbooks when many parties race for the last seats", async () => {
    const testEvent = await createTestEvent(7);
    const sizes = [3, 1, 2, 2, 1, 3, 1, 2, 1, 1, 2, 3];

    const results = await Promise.all(
      sizes.map((size) => signUp(testEvent, { friends: size - 1 })),
    );

    const confirmed = results
      .filter((result) => result.status === "confirmed")
      .reduce((sum, result) => sum + result.seats, 0);
    expect(confirmed).toBeLessThanOrEqual(7);

    // every party left waiting was too big for the seats left when it was
    // decided, and seats only got scarcer after that
    const left = 7 - confirmed;
    for (const result of results.filter((r) => r.status === "waitlisted")) {
      expect(result.seats).toBeGreaterThan(left);
    }

    expect(await getSeatCounts(testEvent.event.id)).toEqual({
      confirmed,
      waitlisted: sizes.reduce((sum, size) => sum + size, 0) - confirmed,
    });
  });

  it("stores one signup when the same email is sent twice at once", async () => {
    const testEvent = await createTestEvent(5);

    const results = await Promise.allSettled([
      signUp(testEvent, { email: "double@example.com" }),
      signUp(testEvent, { email: "double@example.com" }),
    ]);

    expect(results.map((result) => result.status).sort()).toEqual([
      "fulfilled",
      "rejected",
    ]);
    const rejected = results.find((result) => result.status === "rejected");
    expect(rejected?.reason).toBeInstanceOf(DuplicateSignupError);
    expect(await getSeatCounts(testEvent.event.id)).toEqual({
      confirmed: 1,
      waitlisted: 0,
    });
  });
});

describe("updateSignupStatus", () => {
  it("confirms a waiting party even past capacity, and reports where it was", async () => {
    const testEvent = await createTestEvent(1);
    await signUp(testEvent);
    const waiting = await signUp(testEvent, { friends: 1 });

    expect(
      await updateSignupStatus({
        eventId: testEvent.event.id,
        submissionId: waiting.id,
        status: "confirmed",
      }),
    ).toEqual({ previous: "waitlisted" });
    expect(await getSeatCounts(testEvent.event.id)).toEqual({
      confirmed: 3,
      waitlisted: 0,
    });
  });

  it("refuses to revive a cancelled signup whose email signed up again", async () => {
    const testEvent = await createTestEvent(5);
    const first = await signUp(testEvent, { email: "ada@example.com" });
    await updateSignupStatus({
      eventId: testEvent.event.id,
      submissionId: first.id,
      status: "cancelled",
    });
    await signUp(testEvent, { email: "ada@example.com" });

    await expect(
      updateSignupStatus({
        eventId: testEvent.event.id,
        submissionId: first.id,
        status: "confirmed",
      }),
    ).rejects.toBeInstanceOf(DuplicateSignupError);
  });

  it("only changes signups that belong to the event", async () => {
    const one = await createTestEvent(5);
    const other = await createTestEvent(5);
    const signup = await signUp(other);

    await expect(
      updateSignupStatus({
        eventId: one.event.id,
        submissionId: signup.id,
        status: "cancelled",
      }),
    ).rejects.toBeInstanceOf(SignupNotFoundError);
  });
});

describe("getSeatCountsByEvent", () => {
  it("sums confirmed and waiting seats per event, leaving out cancelled ones", async () => {
    const one = await createTestEvent(2);
    const other = await createTestEvent(1);
    await signUp(one, { friends: 1 });
    await signUp(one, { friends: 2 });
    const cancelled = await signUp(other);
    await updateSignupStatus({
      eventId: other.event.id,
      submissionId: cancelled.id,
      status: "cancelled",
    });

    expect(await getSeatCountsByEvent([one.event.id, other.event.id])).toEqual({
      [one.event.id]: { confirmed: 2, waitlisted: 3 },
    });
  });
});
