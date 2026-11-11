import type { Prisma } from "#prisma/generated/client";

import { FormVersionChangedError } from "./form-submission.server";

import { prisma } from "~/db.server";
import { MAX_ADMIN_NOTE_LENGTH } from "~/features/signup-form/bookkeeping";
import {
  MAX_DONATION_RAPPEN,
  type PaymentMethod,
} from "~/features/signup-form/payments";
import {
  ACTIVE_SIGNUP_STATUSES,
  decideSignupStatus,
  normalizeSignupEmail,
  partySize,
  toSignupStatus,
  type SignupStatus,
} from "~/features/signup-form/signup-status";

/** The email already holds a seat or a waiting-list spot for this event. */
export class DuplicateSignupError extends Error {
  constructor() {
    super("This email address is already signed up for the event");
    this.name = "DuplicateSignupError";
  }
}

export class SignupNotFoundError extends Error {
  constructor() {
    super("No such signup for this event");
    this.name = "SignupNotFoundError";
  }
}

type Tx = Prisma.TransactionClient;

function submissionsOf(formId: string) {
  return { formVersion: { formId } } satisfies Prisma.FormSubmissionWhereInput;
}

/**
 * Takes SQLite's write lock before anything is read. SQLite lets one writer
 * through at a time, so a second signup for any event — from this process or
 * another — waits here until this transaction has committed, then counts the
 * seats this one took. Without it, two signups racing for the last seat could
 * both read "1 left" and both be confirmed.
 */
async function lockForSeatChanges(tx: Tx, eventId: string) {
  const touched = await tx.$executeRaw`
    UPDATE "Event" SET "slots" = "slots" WHERE "id" = ${eventId}`;
  if (touched === 0) {
    throw new Error(`Event ${eventId} disappeared during a signup change`);
  }

  return tx.event.findUniqueOrThrow({
    where: { id: eventId },
    select: { slots: true, formId: true },
  });
}

async function confirmedSeatsInTx(tx: Tx, eventId: string, formId: string) {
  const { _sum } = await tx.formSubmission.aggregate({
    _sum: { seats: true },
    where: { ...submissionsOf(formId), status: "confirmed" },
  });
  // rows from before signup forms were configurable: one seat each, and all
  // of them were accepted
  const legacySeats = await tx.eventResponse.count({ where: { eventId } });

  return (_sum.seats ?? 0) + legacySeats;
}

async function hasActiveSignup(
  tx: Tx,
  formId: string,
  email: string,
  exceptId?: string,
) {
  const existing = await tx.formSubmission.findFirst({
    where: {
      ...submissionsOf(formId),
      email,
      status: { in: [...ACTIVE_SIGNUP_STATUSES] },
      ...(exceptId && { id: { not: exceptId } }),
    },
    select: { id: true },
  });

  return existing !== null;
}

/**
 * Stores a signup as confirmed when the whole party still fits, otherwise on
 * the waiting list. A smaller party that arrives later and fits is confirmed
 * even while a bigger one waits, so no seat stays empty.
 */
export async function createEventSignup({
  eventId,
  formVersionId,
  expectedVersionUpdatedAt,
  answers,
  email,
}: {
  eventId: string;
  formVersionId: string;
  expectedVersionUpdatedAt: Date;
  answers: Record<string, unknown>;
  email: string;
}): Promise<{
  id: string;
  status: "confirmed" | "waitlisted";
  seats: number;
}> {
  const seats = partySize(answers);
  const normalizedEmail = normalizeSignupEmail(email);

  return prisma.$transaction(async (tx) => {
    const { slots, formId } = await lockForSeatChanges(tx, eventId);

    const version = await tx.formVersion.findUniqueOrThrow({
      where: { id: formVersionId },
      select: { updatedAt: true },
    });
    if (version.updatedAt.getTime() !== expectedVersionUpdatedAt.getTime()) {
      throw new FormVersionChangedError();
    }

    if (await hasActiveSignup(tx, formId, normalizedEmail)) {
      throw new DuplicateSignupError();
    }

    const status = decideSignupStatus({
      slots,
      confirmedSeats: await confirmedSeatsInTx(tx, eventId, formId),
      seats,
    });

    const { id } = await tx.formSubmission.create({
      data: {
        formVersionId,
        answers: answers as Prisma.InputJsonValue,
        status,
        seats,
        email: normalizedEmail,
      },
      select: { id: true },
    });

    return { id, status, seats };
  });
}

/**
 * An admin moving a signup between confirmed, waiting list and cancelled.
 * Confirming may overbook the event on purpose; reviving a cancelled signup
 * is refused while the same email has signed up again since.
 */
export async function updateSignupStatus({
  eventId,
  submissionId,
  status,
}: {
  eventId: string;
  submissionId: string;
  status: SignupStatus;
}): Promise<{ previous: SignupStatus }> {
  return prisma.$transaction(async (tx) => {
    const { formId } = await lockForSeatChanges(tx, eventId);

    const submission = await tx.formSubmission.findFirst({
      where: { id: submissionId, ...submissionsOf(formId) },
      select: { status: true, email: true },
    });
    if (!submission) throw new SignupNotFoundError();

    const previous = toSignupStatus(submission.status);
    if (previous === status) return { previous };

    if (
      previous === "cancelled" &&
      submission.email &&
      (await hasActiveSignup(tx, formId, submission.email, submissionId))
    ) {
      throw new DuplicateSignupError();
    }

    await tx.formSubmission.update({
      where: { id: submissionId },
      // a mark said whether the mail for the old status went out; the new
      // status calls for another mail
      data: { status, confirmationMarkedSent: null },
    });

    return { previous };
  });
}

/**
 * The admin's own bookkeeping for a signup: whether the party pays in two
 * halves or in one payment, which of them are in and how they came, which
 * mails went out by hand, and a note. Touches nothing the guest or the seats
 * depend on.
 */
export async function updateSignupBookkeeping({
  eventId,
  submissionId,
  data,
}: {
  eventId: string;
  submissionId: string;
  data: {
    singlePayment?: boolean;
    firstHalfPaid?: boolean;
    secondHalfPaid?: boolean;
    firstHalfMethod?: PaymentMethod;
    secondHalfMethod?: PaymentMethod;
    confirmationMarkedSent?: boolean | null;
    paymentReminderSent?: boolean;
    adminNote?: string;
  };
}): Promise<void> {
  if (
    data.adminNote !== undefined &&
    data.adminNote.length > MAX_ADMIN_NOTE_LENGTH
  ) {
    throw new RangeError(
      `Admin notes are at most ${MAX_ADMIN_NOTE_LENGTH} characters`,
    );
  }
  const { count } = await prisma.formSubmission.updateMany({
    where: {
      id: submissionId,
      formVersion: { form: { event: { id: eventId } } },
    },
    data,
  });
  if (count === 0) throw new SignupNotFoundError();
}

/**
 * The admin's bookkeeping for one person in a signup: whether they've
 * arrived, and what they gave. `guestIndex` is their place in the booking
 * (0 is the signer); one past the party is refused like a missing signup.
 */
export async function updateSignupGuest({
  eventId,
  submissionId,
  guestIndex,
  data,
}: {
  eventId: string;
  submissionId: string;
  guestIndex: number;
  data: {
    arrivedAt?: Date | null;
    donationRappen?: number | null;
    donationMethod?: PaymentMethod;
  };
}): Promise<void> {
  if (
    data.donationRappen != null &&
    (!Number.isInteger(data.donationRappen) ||
      data.donationRappen < 0 ||
      data.donationRappen > MAX_DONATION_RAPPEN)
  ) {
    throw new RangeError("A donation is a whole number of Rappen in range");
  }

  const submission = await prisma.formSubmission.findFirst({
    where: {
      id: submissionId,
      formVersion: { form: { event: { id: eventId } } },
    },
    select: { seats: true },
  });
  if (
    !submission ||
    !Number.isInteger(guestIndex) ||
    guestIndex < 0 ||
    guestIndex >= submission.seats
  ) {
    throw new SignupNotFoundError();
  }

  await prisma.signupGuest.upsert({
    where: { submissionId_guestIndex: { submissionId, guestIndex } },
    create: { submissionId, guestIndex, ...data },
    update: data,
  });
}

export interface SeatCounts {
  confirmed: number;
  waitlisted: number;
}

export async function getSeatCountsByEvent(
  eventIds: string[],
): Promise<Record<string, SeatCounts>> {
  const counts: Record<string, SeatCounts> = {};
  if (eventIds.length === 0) return counts;

  const countsFor = (eventId: string) =>
    (counts[eventId] ??= { confirmed: 0, waitlisted: 0 });

  const [submissions, legacy] = await Promise.all([
    prisma.formSubmission.findMany({
      where: {
        status: { in: [...ACTIVE_SIGNUP_STATUSES] },
        formVersion: { form: { event: { id: { in: eventIds } } } },
      },
      select: {
        status: true,
        seats: true,
        formVersion: {
          select: { form: { select: { event: { select: { id: true } } } } },
        },
      },
    }),
    prisma.eventResponse.groupBy({
      by: ["eventId"],
      where: { eventId: { in: eventIds } },
      _count: { _all: true },
    }),
  ]);

  for (const { status, seats, formVersion } of submissions) {
    const eventId = formVersion.form.event?.id;
    if (!eventId) continue;
    countsFor(eventId)[status === "waitlisted" ? "waitlisted" : "confirmed"] +=
      seats;
  }
  for (const { eventId, _count } of legacy) {
    countsFor(eventId).confirmed += _count._all;
  }

  return counts;
}

export async function getSeatCounts(eventId: string): Promise<SeatCounts> {
  const counts = await getSeatCountsByEvent([eventId]);
  return counts[eventId] ?? { confirmed: 0, waitlisted: 0 };
}

/** Everything the signup mail needs, read back from a stored signup. */
export async function getSignupForMail(submissionId: string) {
  return prisma.formSubmission.findUnique({
    where: { id: submissionId },
    select: {
      answers: true,
      email: true,
      formVersion: {
        select: {
          id: true,
          schema: true,
          form: { select: { event: true } },
        },
      },
    },
  });
}
