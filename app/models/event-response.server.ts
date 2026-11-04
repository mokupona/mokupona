import { prisma } from "~/db.server";

export type { EventResponse } from "#prisma/generated/client";

export async function getEventResponsesForEvent(eventId: string) {
  return prisma.eventResponse.findMany({
    where: {
      eventId,
    },
  });
}
