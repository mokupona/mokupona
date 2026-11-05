import type { EventChecklistItem, Prisma } from "#prisma/generated/client";

import { prisma } from "~/db.server";
import { DEFAULT_CHECKLIST_ITEMS } from "~/features/events/checklist";

export type { EventChecklistItem };

const CHECKLIST_ORDER_BY = [
  { position: "asc" },
  { createdAt: "asc" },
] satisfies Prisma.EventChecklistItemOrderByWithRelationInput[];

export async function getChecklistForEvent(
  eventId: string,
): Promise<EventChecklistItem[]> {
  return prisma.eventChecklistItem.findMany({
    where: { eventId },
    orderBy: CHECKLIST_ORDER_BY,
  });
}

async function nextPositionInTx(
  tx: Prisma.TransactionClient,
  eventId: string,
): Promise<number> {
  const last = await tx.eventChecklistItem.findFirst({
    where: { eventId },
    orderBy: { position: "desc" },
    select: { position: true },
  });
  return last ? last.position + 1 : 0;
}

/** Appends the given labels to the end of an event's checklist. */
export async function addChecklistItemsInTx(
  tx: Prisma.TransactionClient,
  eventId: string,
  labels: readonly string[],
): Promise<void> {
  if (labels.length === 0) return;
  const start = await nextPositionInTx(tx, eventId);
  await tx.eventChecklistItem.createMany({
    data: labels.map((label, index) => ({
      eventId,
      label,
      position: start + index,
    })),
  });
}

export async function addChecklistItem(
  eventId: string,
  label: string,
): Promise<void> {
  await prisma.$transaction((tx) =>
    addChecklistItemsInTx(tx, eventId, [label]),
  );
}

/**
 * Adds the default items an event's list doesn't already have (matched by
 * label), so pressing it twice doesn't double them up.
 */
export async function addDefaultChecklistItems(eventId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const existing = await tx.eventChecklistItem.findMany({
      where: { eventId },
      select: { label: true },
    });
    const have = new Set(existing.map((item) => item.label));
    await addChecklistItemsInTx(
      tx,
      eventId,
      DEFAULT_CHECKLIST_ITEMS.filter((label) => !have.has(label)),
    );
  });
}

/**
 * Ticks or unticks one item. Scoped to the event, so an item id from another
 * event's page does nothing; returns whether an item was changed.
 */
export async function setChecklistItemDone(
  eventId: string,
  itemId: string,
  done: boolean,
  now = new Date(),
): Promise<boolean> {
  const { count } = await prisma.eventChecklistItem.updateMany({
    where: { id: itemId, eventId },
    data: { doneAt: done ? now : null },
  });
  return count > 0;
}

/** Removes one item; returns whether it existed on this event. */
export async function deleteChecklistItem(
  eventId: string,
  itemId: string,
): Promise<boolean> {
  const { count } = await prisma.eventChecklistItem.deleteMany({
    where: { id: itemId, eventId },
  });
  return count > 0;
}
