import type { Prisma, Volunteer } from "#prisma/generated/client";

import { prisma } from "~/db.server";
import {
  IMAGE_METADATA_SELECT,
  releaseImagesIfUnreferenced,
  type ImageCreateData,
  type ImageMetadata,
} from "~/models/image.server";

export type { Volunteer };

export interface VolunteerData {
  name: string;
  role?: string;
  bio?: string;
  image?: ImageCreateData;
}

export interface PublicVolunteer {
  id: string;
  name: string;
  role: string | null;
  bio: string | null;
  image: ImageMetadata | null;
}

// public pages render these lists as-is, so the order has to be
// deterministic rather than whatever the engine happens to return
const VOLUNTEER_ORDER: Prisma.VolunteerOrderByWithRelationInput[] = [
  { createdAt: "asc" },
  { name: "asc" },
];

const PUBLIC_VOLUNTEER_SELECT = {
  id: true,
  name: true,
  role: true,
  bio: true,
  image: { select: IMAGE_METADATA_SELECT },
} as const;

export async function countVolunteers(): Promise<number> {
  return prisma.volunteer.count();
}

export async function listVolunteers(): Promise<PublicVolunteer[]> {
  return prisma.volunteer.findMany({
    orderBy: VOLUNTEER_ORDER,
    select: PUBLIC_VOLUNTEER_SELECT,
  });
}

/** The volunteers credited on one event, in the same order as the about page. */
export async function listVolunteersForEvent(
  eventId: string,
): Promise<PublicVolunteer[]> {
  return prisma.volunteer.findMany({
    where: { events: { some: { id: eventId } } },
    orderBy: VOLUNTEER_ORDER,
    select: PUBLIC_VOLUNTEER_SELECT,
  });
}

/** Replaces the set of volunteers credited on an event with exactly `volunteerIds`. */
export async function setEventVolunteers(
  eventId: string,
  volunteerIds: string[],
): Promise<void> {
  await prisma.event.update({
    where: { id: eventId },
    data: {
      volunteers: {
        set: [...new Set(volunteerIds)].map((id) => ({ id })),
      },
    },
  });
}

export async function getVolunteerById(id: string): Promise<Volunteer | null> {
  return prisma.volunteer.findUnique({ where: { id } });
}

export async function createVolunteer(data: VolunteerData): Promise<Volunteer> {
  const { name, role, bio, image } = data;

  return prisma.volunteer.create({
    data: {
      name,
      role: role || null,
      bio: bio || null,
      ...(image && { image: { create: image } }),
    },
  });
}

export async function deleteVolunteer(
  id: string,
): Promise<{ volunteer: Volunteer; imageKey: string | null }> {
  return prisma.$transaction(async (tx) => {
    const volunteer = await tx.volunteer.delete({ where: { id } });

    // released only after the volunteer is gone, so the portrait survives
    // when a gallery still shows it
    let imageKey: string | null = null;
    if (volunteer.imageId) {
      const { storageKeys } = await releaseImagesIfUnreferenced(tx, [
        volunteer.imageId,
      ]);
      imageKey = storageKeys[0] ?? null;
    }

    return { volunteer, imageKey };
  });
}

export async function updateVolunteer(
  id: string,
  data: VolunteerData,
): Promise<{ volunteer: Volunteer; replacedImageKey: string | null }> {
  const { name, role, bio, image } = data;

  return prisma.$transaction(async (tx) => {
    let previousImageId: string | null = null;

    if (image) {
      const current = await tx.volunteer.findUnique({
        where: { id },
        select: { imageId: true },
      });
      previousImageId = current?.imageId ?? null;
    }

    const volunteer = await tx.volunteer.update({
      where: { id },
      data: {
        name,
        role: role || null,
        bio: bio || null,
        ...(image && { image: { create: image } }),
      },
    });

    let replacedImageKey: string | null = null;
    if (previousImageId) {
      const { storageKeys } = await releaseImagesIfUnreferenced(tx, [
        previousImageId,
      ]);
      replacedImageKey = storageKeys[0] ?? null;
    }

    return { volunteer, replacedImageKey };
  });
}
