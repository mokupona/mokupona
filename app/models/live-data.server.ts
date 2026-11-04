import type { Prisma } from "#prisma/generated/client";

import { prisma } from "~/db.server";
import type { LiveDataTables } from "~/features/live-data/snapshot";
import type { LiveDataCounts } from "~/features/live-data/tables";

const INSERT_CHUNK_SIZE = 200;
const REPLACE_TIMEOUT_MS = 120_000;

const TIMESTAMPS = { createdAt: true, updatedAt: true } as const;

/**
 * Migrations applied to this database, oldest first. Compared across the two
 * sites so a copy never lands in a schema older than the one it came from.
 */
export async function listAppliedMigrations(): Promise<string[]> {
  const rows = await prisma.$queryRaw<{ migration_name: string }[]>`
    SELECT migration_name FROM _prisma_migrations
    WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL
    ORDER BY migration_name
  `;
  return rows.map((row) => row.migration_name);
}

export async function countLiveDataTables(): Promise<LiveDataCounts> {
  const [
    addresses,
    images,
    forms,
    formVersions,
    formSubmissions,
    events,
    eventResponses,
    eventGalleryImages,
    boardMembers,
    volunteers,
    eventVolunteers,
  ] = await prisma.$transaction([
    prisma.address.count(),
    prisma.image.count(),
    prisma.form.count(),
    prisma.formVersion.count(),
    prisma.formSubmission.count(),
    prisma.event.count(),
    prisma.eventResponse.count(),
    prisma.eventGalleryImage.count(),
    prisma.boardMember.count(),
    prisma.volunteer.count(),
    // the implicit join has no model of its own; each credit is one event
    // seen from one volunteer
    prisma.event.count({ where: { volunteers: { some: {} } } }),
  ]);

  return {
    addresses,
    images,
    forms,
    formVersions,
    formSubmissions,
    events,
    eventResponses,
    eventGalleryImages,
    boardMembers,
    volunteers,
    eventVolunteers,
  };
}

/**
 * Every content row, read in one transaction so the copy is a consistent
 * point-in-time view. Each select is an explicit allowlist: a column added to
 * the schema later stays on this site until someone decides it should travel.
 */
export async function readLiveDataTables({
  includeSignups,
}: {
  includeSignups: boolean;
}): Promise<LiveDataTables> {
  const byId = { id: "asc" } as const;

  const [
    addresses,
    images,
    forms,
    formVersions,
    formSubmissions,
    events,
    eventResponses,
    eventGalleryImages,
    boardMembers,
    volunteers,
  ] = await prisma.$transaction([
    prisma.address.findMany({
      orderBy: byId,
      select: {
        id: true,
        streetName: true,
        houseNumber: true,
        zip: true,
        city: true,
      },
    }),
    prisma.image.findMany({
      orderBy: byId,
      select: {
        id: true,
        altText: true,
        contentType: true,
        storageKey: true,
        version: true,
        width: true,
        height: true,
        blurDataUrl: true,
        ...TIMESTAMPS,
      },
    }),
    prisma.form.findMany({
      orderBy: byId,
      select: { id: true, ...TIMESTAMPS },
    }),
    prisma.formVersion.findMany({
      orderBy: byId,
      select: {
        id: true,
        formId: true,
        version: true,
        schema: true,
        ...TIMESTAMPS,
      },
    }),
    prisma.formSubmission.findMany({
      orderBy: byId,
      // `take: 0` keeps the batch shape when signups stay behind
      ...(includeSignups ? {} : { take: 0 }),
      select: {
        id: true,
        formVersionId: true,
        answers: true,
        createdAt: true,
      },
    }),
    prisma.event.findMany({
      orderBy: byId,
      select: {
        id: true,
        title: true,
        description: true,
        menuDescription: true,
        donationDescription: true,
        date: true,
        slots: true,
        price: true,
        discounts: true,
        imageId: true,
        addressId: true,
        formId: true,
        createdBy: { select: { email: true } },
      },
    }),
    prisma.eventResponse.findMany({
      orderBy: byId,
      ...(includeSignups ? {} : { take: 0 }),
      select: {
        id: true,
        eventId: true,
        name: true,
        email: true,
        phone: true,
        vegetarian: true,
        student: true,
        restrictions: true,
        comment: true,
        ...TIMESTAMPS,
      },
    }),
    prisma.eventGalleryImage.findMany({
      orderBy: byId,
      select: {
        id: true,
        eventId: true,
        imageId: true,
        caption: true,
        position: true,
        ...TIMESTAMPS,
      },
    }),
    prisma.boardMember.findMany({
      orderBy: byId,
      select: {
        id: true,
        name: true,
        position: true,
        bio: true,
        imageId: true,
        ...TIMESTAMPS,
      },
    }),
    prisma.volunteer.findMany({
      orderBy: byId,
      select: {
        id: true,
        name: true,
        role: true,
        bio: true,
        imageId: true,
        ...TIMESTAMPS,
        events: { orderBy: byId, select: { id: true } },
      },
    }),
  ]);

  return {
    addresses,
    images,
    forms,
    formVersions: formVersions.map((row) => ({
      ...row,
      schema: row.schema as LiveDataTables["formVersions"][number]["schema"],
    })),
    formSubmissions: formSubmissions.map((row) => ({
      ...row,
      answers:
        row.answers as LiveDataTables["formSubmissions"][number]["answers"],
    })),
    events: events.map(({ createdBy, ...event }) => ({
      ...event,
      createdByEmail: createdBy?.email ?? null,
    })),
    eventResponses,
    eventGalleryImages,
    boardMembers,
    volunteers: volunteers.map(
      ({ events: _events, ...volunteer }) => volunteer,
    ),
    eventVolunteers: volunteers.flatMap((volunteer) =>
      volunteer.events.map((event) => ({
        eventId: event.id,
        volunteerId: volunteer.id,
      })),
    ),
  };
}

/** Current image rows by id — the copy target's record of earlier copies. */
export async function getImageCopiesByIds(ids: string[]): Promise<
  {
    id: string;
    storageKey: string;
    contentType: string;
    version: number | null;
    width: number | null;
    height: number | null;
    blurDataUrl: string | null;
  }[]
> {
  if (ids.length === 0) return [];
  return prisma.image.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      storageKey: true,
      contentType: true,
      version: true,
      width: true,
      height: true,
      blurDataUrl: true,
    },
  });
}

function chunk<T>(rows: T[]): T[][] {
  const chunks: T[][] = [];
  for (let start = 0; start < rows.length; start += INSERT_CHUNK_SIZE) {
    chunks.push(rows.slice(start, start + INSERT_CHUNK_SIZE));
  }
  return chunks;
}

async function insertAll<T>(
  rows: T[],
  createMany: (data: T[]) => Promise<unknown>,
) {
  for (const part of chunk(rows)) {
    await createMany(part);
  }
}

/**
 * Swap every content table for the given rows in one transaction: either the
 * whole copy lands or this database is left exactly as it was. Users,
 * sessions, accounts, invites and roles are not touched.
 *
 * Returns the storageKeys of the images that were here before, for the
 * caller's post-commit provider cleanup.
 */
export async function replaceLiveDataTables(
  tables: LiveDataTables,
): Promise<{ previousStorageKeys: string[] }> {
  return prisma.$transaction(
    async (tx) => {
      const previous = await tx.image.findMany({
        select: { storageKey: true },
      });

      const creatorEmails = [
        ...new Set(
          tables.events
            .map((event) => event.createdByEmail?.toLowerCase())
            .filter((email): email is string => Boolean(email)),
        ),
      ];
      const creators = await tx.user.findMany({
        where: { email: { in: creatorEmails } },
        select: { id: true, email: true },
      });
      const userIdByEmail = new Map(
        creators.map((user) => [user.email.toLowerCase(), user.id]),
      );

      // children before parents, so no Restrict relation can object
      await tx.eventGalleryImage.deleteMany();
      await tx.eventResponse.deleteMany();
      await tx.event.deleteMany();
      await tx.formSubmission.deleteMany();
      await tx.formVersion.deleteMany();
      await tx.form.deleteMany();
      await tx.boardMember.deleteMany();
      // takes the event credits with it (the join cascades)
      await tx.volunteer.deleteMany();
      await tx.image.deleteMany();
      await tx.address.deleteMany();

      await insertAll(tables.addresses, (data) =>
        tx.address.createMany({ data }),
      );
      await insertAll(tables.images, (data) => tx.image.createMany({ data }));
      await insertAll(tables.forms, (data) => tx.form.createMany({ data }));
      await insertAll(tables.formVersions, (data) =>
        tx.formVersion.createMany({
          data: data.map((row) => ({
            ...row,
            schema: row.schema as Prisma.InputJsonValue,
          })),
        }),
      );
      await insertAll(tables.formSubmissions, (data) =>
        tx.formSubmission.createMany({
          data: data.map((row) => ({
            ...row,
            answers: row.answers as Prisma.InputJsonValue,
          })),
        }),
      );
      await insertAll(tables.events, (data) =>
        tx.event.createMany({
          data: data.map(({ createdByEmail, ...event }) => ({
            ...event,
            createdById: createdByEmail
              ? (userIdByEmail.get(createdByEmail.toLowerCase()) ?? null)
              : null,
          })),
        }),
      );
      await insertAll(tables.eventResponses, (data) =>
        tx.eventResponse.createMany({ data }),
      );
      await insertAll(tables.eventGalleryImages, (data) =>
        tx.eventGalleryImage.createMany({ data }),
      );
      await insertAll(tables.boardMembers, (data) =>
        tx.boardMember.createMany({ data }),
      );
      await insertAll(tables.volunteers, (data) =>
        tx.volunteer.createMany({ data }),
      );
      for (const [volunteerId, eventIds] of groupEventIdsByVolunteer(
        tables.eventVolunteers,
      )) {
        await tx.volunteer.update({
          where: { id: volunteerId },
          data: { events: { connect: eventIds.map((id) => ({ id })) } },
        });
      }

      return {
        previousStorageKeys: previous.map((image) => image.storageKey),
      };
    },
    { timeout: REPLACE_TIMEOUT_MS, maxWait: 10_000 },
  );
}

function groupEventIdsByVolunteer(
  rows: LiveDataTables["eventVolunteers"],
): Map<string, string[]> {
  const grouped = new Map<string, string[]>();
  for (const { eventId, volunteerId } of rows) {
    const eventIds = grouped.get(volunteerId) ?? [];
    eventIds.push(eventId);
    grouped.set(volunteerId, eventIds);
  }
  return grouped;
}
