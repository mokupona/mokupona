import { z } from "zod";

import { LIVE_DATA_TABLES, type LiveDataCounts } from "./tables";

import {
  normalizeSignupEmail,
  partySize,
  toSignupStatus,
} from "~/features/signup-form/signup-status";

/**
 * Wire format of a live-data copy. The live site serialises its content
 * tables to this shape; the copy target validates against it before touching
 * its own database. Bump `LIVE_DATA_FORMAT_VERSION` on any breaking change so
 * mismatched deploys refuse instead of half-importing.
 */
export const LIVE_DATA_FORMAT = "mokupona/live-data";
export const LIVE_DATA_FORMAT_VERSION = 1;

const id = z.string().min(1);
const text = z.string();
const nullableText = z.string().nullable();
const int = z.number().int();
const dateTime = z.iso.datetime().transform((value) => new Date(value));
// Prisma `Json` columns here always hold an object or an array
const jsonDocument = z.union([
  z.record(z.string(), z.json()),
  z.array(z.json()),
]);

const addressRow = z.object({
  id,
  streetName: text,
  houseNumber: text,
  zip: text,
  city: text,
});

const imageRow = z.object({
  id,
  altText: nullableText,
  contentType: text,
  storageKey: z.string().min(1),
  version: int.nullable(),
  width: int.nullable(),
  height: int.nullable(),
  blurDataUrl: nullableText,
  // the admin's framing (app/shared/image-crop.ts); a live site on older
  // code has none
  cropX: z.number().nullable().optional(),
  cropY: z.number().nullable().optional(),
  cropWidth: z.number().nullable().optional(),
  cropHeight: z.number().nullable().optional(),
  createdAt: dateTime,
  updatedAt: dateTime,
});

const formRow = z.object({ id, createdAt: dateTime, updatedAt: dateTime });

const formVersionRow = z.object({
  id,
  formId: id,
  version: int,
  schema: jsonDocument,
  createdAt: dateTime,
  updatedAt: dateTime,
});

const formSubmissionRow = z
  .object({
    id,
    formVersionId: id,
    answers: jsonDocument,
    // added after format version 1 shipped: a live site on older code leaves
    // them out. Its signups were all accepted, and seats and email can be
    // read off the answers the same way the migration backfilled them.
    status: z.string().optional(),
    seats: int.positive().optional(),
    email: z.string().optional(),
    // the admin's payment ticks and note; a live site on older code has none
    firstHalfPaid: z.boolean().optional(),
    secondHalfPaid: z.boolean().optional(),
    adminNote: z.string().optional(),
    createdAt: dateTime,
  })
  .transform(
    ({
      status,
      seats,
      email,
      firstHalfPaid,
      secondHalfPaid,
      adminNote,
      ...row
    }) => {
      const answers = Array.isArray(row.answers) ? {} : row.answers;
      return {
        ...row,
        status: toSignupStatus(status),
        seats: seats ?? partySize(answers),
        email:
          email ??
          normalizeSignupEmail(
            typeof answers.email === "string" ? answers.email : "",
          ),
        firstHalfPaid: firstHalfPaid ?? false,
        secondHalfPaid: secondHalfPaid ?? false,
        adminNote: adminNote ?? "",
      };
    },
  );

const eventRow = z
  .object({
    id,
    title: text,
    description: text,
    menuDescription: nullableText,
    donationDescription: nullableText,
    date: dateTime,
    slots: int,
    // added after format version 1 shipped: a live site on older code has no
    // drafts, so every event it sends is public
    published: z.boolean().default(true),
    price: int,
    // the stackable discounts replaced a fixed student price; a live site on
    // older code sends that instead and it is turned into the same deduction
    studentPrice: int.nullable().optional(),
    studentDiscount: int.nullable().optional(),
    vegetarianDiscount: int.nullable().default(null),
    discounts: nullableText,
    confirmedMailSubject: nullableText.default(null),
    confirmedMailMessage: nullableText.default(null),
    waitlistMailSubject: nullableText.default(null),
    waitlistMailMessage: nullableText.default(null),
    imageId: id.nullable(),
    addressId: id,
    formId: id,
    // users are not copied, so the creator travels as an email the target
    // matches against its own accounts (or drops)
    createdByEmail: nullableText,
  })
  .transform(({ studentPrice, studentDiscount, ...row }) => ({
    ...row,
    studentDiscount:
      studentDiscount !== undefined
        ? studentDiscount
        : studentPrice != null
          ? Math.max(0, row.price - studentPrice)
          : null,
  }));

const eventResponseRow = z.object({
  id,
  eventId: id,
  name: text,
  email: text,
  phone: text,
  vegetarian: z.boolean().nullable(),
  student: z.boolean().nullable(),
  restrictions: nullableText,
  comment: nullableText,
  createdAt: dateTime,
  updatedAt: dateTime,
});

const eventGalleryImageRow = z.object({
  id,
  eventId: id,
  imageId: id,
  caption: nullableText,
  position: int,
  createdAt: dateTime,
  updatedAt: dateTime,
});

const boardMemberRow = z.object({
  id,
  name: text,
  position: text,
  // added after format version 1 shipped: a live site on older code leaves
  // it out, which reads as "no bio"
  bio: nullableText.default(null),
  imageId: id.nullable(),
  createdAt: dateTime,
  updatedAt: dateTime,
});

const volunteerRow = z.object({
  id,
  name: text,
  role: nullableText,
  bio: nullableText,
  imageId: id.nullable(),
  createdAt: dateTime,
  updatedAt: dateTime,
});

/** One row of the implicit Event ↔ Volunteer join: who helped at what. */
const eventVolunteerRow = z.object({
  eventId: id,
  volunteerId: id,
});

// an admin's wording from /admin/texts; texts nobody edited have no row
const siteTextRow = z.object({
  key: z.string().min(1),
  value: text,
  defaultAtEdit: text,
  createdAt: dateTime,
  updatedAt: dateTime,
});

export const liveDataTablesSchema = z.object({
  addresses: z.array(addressRow),
  images: z.array(imageRow),
  forms: z.array(formRow),
  formVersions: z.array(formVersionRow),
  formSubmissions: z.array(formSubmissionRow),
  events: z.array(eventRow),
  eventResponses: z.array(eventResponseRow),
  eventGalleryImages: z.array(eventGalleryImageRow),
  boardMembers: z.array(boardMemberRow),
  // added after format version 1 shipped, so absent from exports made by a
  // live site on older code: no volunteers, and no edited texts, which shows
  // the defaults just as the live site does
  volunteers: z.array(volunteerRow).default([]),
  eventVolunteers: z.array(eventVolunteerRow).default([]),
  siteTexts: z.array(siteTextRow).default([]),
});

export type LiveDataTables = z.output<typeof liveDataTablesSchema>;
export type LiveDataImageRow = LiveDataTables["images"][number];

// tables a live site running older code does not send at all
const LATER_TABLES = new Set<string>([
  "volunteers",
  "eventVolunteers",
  "siteTexts",
]);

const countsSchema = z.object(
  Object.fromEntries(
    LIVE_DATA_TABLES.map((table) => [
      table,
      LATER_TABLES.has(table)
        ? int.nonnegative().default(0)
        : int.nonnegative(),
    ]),
  ) as unknown as Record<
    keyof LiveDataCounts,
    z.ZodType<number, number | undefined>
  >,
);

const sourceSchema = z.object({
  /** Latest migration applied on the live site, null on an empty history. */
  schemaVersion: z.string().nullable(),
  imageProvider: z.enum(["local", "cloudinary"]),
  cloudinaryCloudName: z.string().nullable(),
});

export type LiveDataSource = z.output<typeof sourceSchema>;

const header = {
  format: z.literal(LIVE_DATA_FORMAT),
  formatVersion: z.literal(LIVE_DATA_FORMAT_VERSION),
  exportedAt: dateTime,
  includesSignups: z.boolean(),
  source: sourceSchema,
  counts: countsSchema,
};

export const liveDataSummarySchema = z.object(header);
export const liveDataSnapshotSchema = z.object({
  ...header,
  data: liveDataTablesSchema,
});

export type LiveDataSummary = z.output<typeof liveDataSummarySchema>;
export type LiveDataSnapshot = z.output<typeof liveDataSnapshotSchema>;

export function countLiveDataRows(tables: LiveDataTables): LiveDataCounts {
  return Object.fromEntries(
    LIVE_DATA_TABLES.map((table) => [table, tables[table].length]),
  ) as LiveDataCounts;
}
