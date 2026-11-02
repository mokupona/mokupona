import { DEFAULT_FORM } from "./default-form";
import { toSignupStatus, type SignupStatus } from "./signup-status";

import type { parseStoredFormSchema } from "~/features/forms/serialization";
import { parseStoredFormSchemaOrLog } from "~/features/forms/serialization.server";
import { requestLogger } from "~/logger/request-context.server";
import {
  getEventResponsesForEvent,
  type EventResponse,
} from "~/models/event-response.server";
import {
  getFormSubmissionAnswersByEvent,
  getFormSubmissionsForEvent,
} from "~/models/form-submission.server";
import { getCurrentFormVersionForEvent } from "~/models/form.server";

export interface Attendee {
  submissionId: string;
  /** Shared by everyone in a party; legacy rows read as confirmed. */
  status: SignupStatus;
  isSigner: boolean | null;
  name: string;
  email: string;
  phone: string;
  answers: Record<string, string | boolean>;
  createdAt: Date;
}

export interface RosterColumn {
  name: string;
  label: string;
}

const FRIENDS_LIST_NAME = "friends";

interface RosterDrops {
  versionsWithoutSchema: number;
  submissionsWithoutSchema: number;
  submissionsWithMalformedAnswers: number;
  friendEntriesDropped: number;
  answerValuesDropped: number;
}

function newRosterDrops(): RosterDrops {
  return {
    versionsWithoutSchema: 0,
    submissionsWithoutSchema: 0,
    submissionsWithMalformedAnswers: 0,
    friendEntriesDropped: 0,
    answerValuesDropped: 0,
  };
}

function reportRosterDrops(eventId: string, drops: RosterDrops) {
  if (Object.values(drops).every((count) => count === 0)) return;

  requestLogger.error(
    { event: eventId, reason: drops },
    "Dropped attendee data while loading the roster",
  );
}

export async function getAttendeesForEvent(
  eventId: string,
): Promise<Attendee[]> {
  const { attendees } = await loadRoster(eventId);
  return attendees;
}

export type AnswerCountsByFieldKey = Record<
  string,
  { friends: number; total: number }
>;

export async function getAnswerCountsByFieldKey(
  eventId: string,
): Promise<{ counts: AnswerCountsByFieldKey; hasResponses: boolean }> {
  const counts: AnswerCountsByFieldKey = {};
  const [legacyRows, submissions] = await Promise.all([
    getEventResponsesForEvent(eventId),
    getFormSubmissionAnswersByEvent([eventId]),
  ]);

  const bump = (key: string, part: "friends" | "total") => {
    (counts[key] ??= { friends: 0, total: 0 })[part] += 1;
  };

  for (const row of legacyRows) {
    for (const [key, value] of Object.entries(
      legacyRowToAttendee(row).answers,
    )) {
      if (isAnsweredValue(value)) bump(key, "total");
    }
  }

  for (const { answers: rawAnswers } of submissions) {
    const answers = asRecord(rawAnswers);
    if (!answers) continue;

    for (const [key, value] of Object.entries(answers)) {
      if (key === FRIENDS_LIST_NAME) continue;
      if (isAnsweredValue(value)) bump(key, "total");
    }

    const friends = Array.isArray(answers[FRIENDS_LIST_NAME])
      ? (answers[FRIENDS_LIST_NAME] as unknown[])
      : [];
    for (const item of friends) {
      const record = asRecord(item);
      if (!record) continue;
      for (const [key, value] of Object.entries(record)) {
        if (!isAnsweredValue(value)) continue;
        bump(key, "friends");
        bump(key, "total");
      }
    }
  }

  return {
    counts,
    hasResponses: legacyRows.length > 0 || submissions.length > 0,
  };
}

function isAnsweredValue(value: unknown): boolean {
  if (typeof value === "string") return value.length > 0;
  if (typeof value === "boolean") return value;
  return false;
}

export async function getAttendeeRosterForEvent(eventId: string): Promise<{
  attendees: Attendee[];
  columns: RosterColumn[];
}> {
  const { attendees, schemas, hasLegacyRows } = await loadRoster(eventId);

  const columnSchemas = [...schemas];
  if (columnSchemas.length === 0) {
    const currentVersion = await getCurrentFormVersionForEvent(eventId);
    const parsed = currentVersion
      ? parseStoredFormSchemaOrLog(currentVersion)
      : null;
    if (parsed) columnSchemas.push(parsed);
  }
  if (hasLegacyRows || columnSchemas.length === 0) {
    columnSchemas.push(DEFAULT_FORM);
  }

  return { attendees, columns: deriveColumns(columnSchemas) };
}

type StoredFormSchema = NonNullable<
  ReturnType<typeof parseStoredFormSchema>["data"]
>;

async function loadRoster(eventId: string): Promise<{
  attendees: Attendee[];
  schemas: StoredFormSchema[];
  hasLegacyRows: boolean;
}> {
  const [legacyRows, submissions] = await Promise.all([
    getEventResponsesForEvent(eventId),
    getFormSubmissionsForEvent(eventId),
  ]);

  const versions = [
    ...new Map(
      submissions.map(({ formVersion }) => [formVersion.id, formVersion]),
    ).values(),
  ].sort((a, b) => b.version - a.version);

  const drops = newRosterDrops();
  const descriptorsByVersion = new Map<string, StoredFormSchema>();
  for (const version of versions) {
    const parsed = parseStoredFormSchemaOrLog(version);
    if (parsed) descriptorsByVersion.set(version.id, parsed);
    else drops.versionsWithoutSchema += 1;
  }

  const attendees = [
    ...legacyRows.map(legacyRowToAttendee),
    ...submissions.flatMap((submission) => {
      const descriptors = descriptorsByVersion.get(submission.formVersionId);
      if (!descriptors) {
        drops.submissionsWithoutSchema += 1;
        return [];
      }
      return flattenSubmission(submission, descriptors, drops);
    }),
  ].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

  reportRosterDrops(eventId, drops);

  return {
    attendees,
    schemas: versions
      .map((version) => descriptorsByVersion.get(version.id))
      .filter((descriptors) => descriptors !== undefined),
    hasLegacyRows: legacyRows.length > 0,
  };
}

type StoredSubmission = Awaited<
  ReturnType<typeof getFormSubmissionsForEvent>
>[number];

function flattenSubmission(
  submission: StoredSubmission,
  descriptors: StoredFormSchema,
  drops: RosterDrops,
): Attendee[] {
  const answers = asRecord(submission.answers);
  if (!answers) {
    drops.submissionsWithMalformedAnswers += 1;
    return [];
  }

  const friendsList = descriptors.find(
    (field) => field.type === "list" && field.data.name === FRIENDS_LIST_NAME,
  );
  const perAttendeeNames = new Set(
    friendsList?.type === "list"
      ? friendsList.data.itemFields.map((item) => item.data.name)
      : [],
  );

  const topLevel: Record<string, string | boolean> = {};
  const submissionLevel: Record<string, string | boolean> = {};
  for (const field of descriptors) {
    if (field.type === "list") continue;
    const value = answers[field.data.name];
    if (typeof value !== "string" && typeof value !== "boolean") {
      if (value !== undefined) drops.answerValuesDropped += 1;
      continue;
    }
    topLevel[field.data.name] = value;
    if (!perAttendeeNames.has(field.data.name)) {
      submissionLevel[field.data.name] = value;
    }
  }

  const shared = {
    submissionId: submission.id,
    status: toSignupStatus(submission.status),
    email: asString(topLevel["email"]),
    phone: asString(topLevel["phone"]),
    createdAt: submission.createdAt,
  };

  const signer: Attendee = {
    ...shared,
    isSigner: true,
    name: asString(topLevel["name"]),
    answers: topLevel,
  };

  const friendItems = Array.isArray(answers[FRIENDS_LIST_NAME])
    ? (answers[FRIENDS_LIST_NAME] as unknown[])
    : [];

  const friends = friendItems.flatMap((item): Attendee[] => {
    const record = asRecord(item);
    if (!record) {
      drops.friendEntriesDropped += 1;
      return [];
    }

    const personal: Record<string, string | boolean> = {};
    for (const [name, value] of Object.entries(record)) {
      if (typeof value === "string" || typeof value === "boolean") {
        personal[name] = value;
      } else {
        drops.answerValuesDropped += 1;
      }
    }

    return [
      {
        ...shared,
        isSigner: false,
        name: asString(personal["name"]),
        answers: { ...submissionLevel, ...personal },
      },
    ];
  });

  return [signer, ...friends];
}

function legacyRowToAttendee(row: EventResponse): Attendee {
  return {
    submissionId: row.id,
    status: "confirmed",
    isSigner: null,
    name: row.name,
    email: row.email,
    phone: row.phone,
    createdAt: row.createdAt,
    answers: {
      name: row.name,
      email: row.email,
      phone: row.phone,
      vegetarian: row.vegetarian ?? false,
      student: row.student ?? false,
      restrictions: row.restrictions ?? "",
      comment: row.comment ?? "",
    },
  };
}

function deriveColumns(schemas: StoredFormSchema[]): RosterColumn[] {
  const columns: RosterColumn[] = [];
  const seen = new Set<string>();

  const push = (name: string, label: string) => {
    if (seen.has(name)) return;
    seen.add(name);
    columns.push({ name, label });
  };

  for (const fields of schemas) {
    for (const field of fields) {
      if (field.type === "list") {
        for (const item of field.data.itemFields) {
          push(item.data.name, item.data.label);
        }
      } else {
        push(field.data.name, field.data.label);
      }
    }
  }

  return columns;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}
