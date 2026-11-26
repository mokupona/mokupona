import type { Prisma } from "#prisma/generated/client";

import { FormVersionChangedError } from "./form-submission.server";

import { prisma } from "~/db.server";
import { MAX_ADMIN_NOTE_LENGTH } from "~/features/signup-form/bookkeeping";
import {
  MAX_CUSTOM_PRICE_RAPPEN,
  MAX_DONATION_RAPPEN,
  type PaymentMethod,
  type PriceShare,
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

/**
 * Cancelling this person would leave their group with nobody in it: that's
 * cancelling the signup.
 */
export class LastGuestError extends Error {
  constructor() {
    super("The last person in a signup can't be cancelled on their own");
    this.name = "LastGuestError";
  }
}

type Tx = Prisma.TransactionClient;

/**
 * The people in a signup who take no seat: helpers, and anyone cancelled on
 * their own while the rest of the group still comes.
 */
const SEATLESS_GUEST = {
  OR: [{ helper: true }, { cancelledAt: { not: null } }],
} satisfies Prisma.SignupGuestWhereInput;

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
  const confirmed = { ...submissionsOf(formId), status: "confirmed" };
  const { _sum } = await tx.formSubmission.aggregate({
    _sum: { seats: true },
    where: confirmed,
  });
  // a helper in a confirmed party takes no seat, and nor does someone in it
  // who was cancelled on their own
  const seatless = await tx.signupGuest.count({
    where: { ...SEATLESS_GUEST, submission: confirmed },
  });
  // rows from before signup forms were configurable: one seat each, and all
  // of them were accepted
  const legacySeats = await tx.eventResponse.count({ where: { eventId } });

  return (_sum.seats ?? 0) - seatless + legacySeats;
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
 *
 * A first half (or the one payment) ticked as paid when it wasn't also ticks
 * the payment reminder: a party that has paid needs no reminder, and the
 * second half is paid on the night. Unticking it again leaves the reminder
 * as it is, and so does saving a first half that was already ticked.
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
  const where = {
    id: submissionId,
    formVersion: { form: { event: { id: eventId } } },
  } satisfies Prisma.FormSubmissionWhereInput;

  const [, { count }] = await prisma.$transaction([
    // read before the ticks below land, so only a newly paid half counts
    prisma.formSubmission.updateMany({
      where: data.firstHalfPaid
        ? { ...where, firstHalfPaid: false }
        : // nothing newly paid: matches no row
          { id: { in: [] } },
      data: { paymentReminderSent: true },
    }),
    prisma.formSubmission.updateMany({ where, data }),
  ]);
  if (count === 0) throw new SignupNotFoundError();
}

/**
 * The admin's bookkeeping for one person in a signup: whether they've
 * arrived, what they gave, what share of their price they pay (with the
 * amount, when an admin set it themselves), and whether they're a helper
 * (who takes no seat). `guestIndex` is their place in the booking
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
    priceShare?: PriceShare;
    customPriceRappen?: number | null;
    helper?: boolean;
  };
}): Promise<void> {
  if (
    data.donationRappen != null &&
    !isRappenInRange(data.donationRappen, MAX_DONATION_RAPPEN)
  ) {
    throw new RangeError("A donation is a whole number of Rappen in range");
  }
  if (
    data.customPriceRappen != null &&
    !isRappenInRange(data.customPriceRappen, MAX_CUSTOM_PRICE_RAPPEN)
  ) {
    throw new RangeError("A custom price is a whole number of Rappen in range");
  }
  // only a custom share has an amount, and it always comes with one
  if (
    (data.priceShare === "custom") !==
    (data.customPriceRappen !== undefined && data.customPriceRappen !== null)
  ) {
    throw new RangeError("A custom price share comes with its amount");
  }
  // any other share drops the amount a custom one had
  const update =
    data.priceShare !== undefined && data.priceShare !== "custom"
      ? { ...data, customPriceRappen: null }
      : data;

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
    create: { submissionId, guestIndex, ...update },
    update,
  });
}

function isRappenInRange(amount: number, max: number): boolean {
  return Number.isInteger(amount) && amount >= 0 && amount <= max;
}

/**
 * An admin cancelling one person in a group while the rest keep their place,
 * or bringing them back. A cancelled person takes no seat and pays nothing.
 * The last person still in a group can't be cancelled on their own: that's
 * cancelling the signup. Bringing someone back to a confirmed group may
 * overbook the event, like confirming a group may. `guestIndex` is their
 * place in the booking (0 is the signer); one past the party is refused like
 * a missing signup.
 */
export async function setSignupGuestCancelled({
  eventId,
  submissionId,
  guestIndex,
  cancelled,
}: {
  eventId: string;
  submissionId: string;
  guestIndex: number;
  cancelled: boolean;
}): Promise<{ changed: boolean; status: SignupStatus }> {
  return prisma.$transaction(async (tx) => {
    const { formId } = await lockForSeatChanges(tx, eventId);

    const submission = await tx.formSubmission.findFirst({
      where: { id: submissionId, ...submissionsOf(formId) },
      select: {
        seats: true,
        status: true,
        guestBookkeeping: {
          where: { cancelledAt: { not: null } },
          select: { guestIndex: true },
        },
      },
    });
    if (
      !submission ||
      !Number.isInteger(guestIndex) ||
      guestIndex < 0 ||
      guestIndex >= submission.seats
    ) {
      throw new SignupNotFoundError();
    }

    const status = toSignupStatus(submission.status);
    const cancelledBefore = submission.guestBookkeeping.map(
      (guest) => guest.guestIndex,
    );
    if (cancelledBefore.includes(guestIndex) === cancelled) {
      return { changed: false, status };
    }
    if (cancelled && submission.seats - cancelledBefore.length <= 1) {
      throw new LastGuestError();
    }

    const cancelledAt = cancelled ? new Date() : null;
    await tx.signupGuest.upsert({
      where: { submissionId_guestIndex: { submissionId, guestIndex } },
      create: { submissionId, guestIndex, cancelledAt },
      update: { cancelledAt },
    });

    return { changed: true, status };
  });
}

/**
 * The seats an event's signups take, by status. A helper (ticked on the
 * signup sheet) takes none, so an event isn't full because of its helpers,
 * and nor does someone cancelled on their own while their group still comes.
 */
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
        _count: {
          select: { guestBookkeeping: { where: SEATLESS_GUEST } },
        },
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

  for (const { status, seats, _count, formVersion } of submissions) {
    const eventId = formVersion.form.event?.id;
    if (!eventId) continue;
    countsFor(eventId)[status === "waitlisted" ? "waitlisted" : "confirmed"] +=
      seats - _count.guestBookkeeping;
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
      // the people cancelled on their own, whom the mail leaves out
      guestBookkeeping: {
        where: { cancelledAt: { not: null } },
        select: { guestIndex: true },
      },
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
