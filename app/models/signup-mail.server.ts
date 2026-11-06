import type { Prisma } from "#prisma/generated/client";

import { prisma } from "~/db.server";
import {
  toSentSignupMail,
  type SignupMailRecordKind,
} from "~/features/signup-form/signup-mails";
import { toSignupStatus } from "~/features/signup-form/signup-status";

/** What the signup sheet reads of each mail a signup got. */
export const SIGNUP_MAIL_SELECT = {
  kind: true,
  recipient: true,
  subject: true,
  message: true,
  createdAt: true,
  sentBy: { select: { name: true } },
} satisfies Prisma.SignupMailSelect;

export const SIGNUP_MAIL_ORDER_BY = [
  { createdAt: "asc" },
  { id: "asc" },
] satisfies Prisma.SignupMailOrderByWithRelationInput[];

/**
 * Keeps a record of a mail that went out about a signup. The signup mail
 * itself (seat confirmed or waiting list) also clears an admin's mark of
 * whether it went out, so the record speaks from then on.
 */
export async function recordSignupMail({
  submissionId,
  kind,
  recipient,
  subject = "",
  message = "",
  sentById = null,
}: {
  submissionId: string;
  kind: SignupMailRecordKind;
  recipient: string;
  subject?: string;
  message?: string;
  /** The admin who sent it; null when it went out on its own at signup. */
  sentById?: string | null;
}): Promise<void> {
  const record = prisma.signupMail.create({
    data: { submissionId, kind, recipient, subject, message, sentById },
  });
  if (kind !== "confirmed" && kind !== "waitlisted") {
    await record;
    return;
  }

  await prisma.$transaction([
    record,
    prisma.formSubmission.update({
      where: { id: submissionId },
      data: { confirmationMarkedSent: null },
    }),
  ]);
}

/**
 * A signup's status and the mails it got, or null when the event has no such
 * signup. What the signup sheet checks before it sends anything.
 */
export async function getSignupMailState({
  eventId,
  submissionId,
}: {
  eventId: string;
  submissionId: string;
}) {
  const submission = await prisma.formSubmission.findFirst({
    where: {
      id: submissionId,
      formVersion: { form: { event: { id: eventId } } },
    },
    select: {
      status: true,
      mailsTracked: true,
      confirmationMarkedSent: true,
      mails: { orderBy: SIGNUP_MAIL_ORDER_BY, select: SIGNUP_MAIL_SELECT },
    },
  });
  if (!submission) return null;

  return {
    status: toSignupStatus(submission.status),
    mailsTracked: submission.mailsTracked,
    markedSent: submission.confirmationMarkedSent,
    mails: submission.mails.flatMap(toSentSignupMail),
  };
}
