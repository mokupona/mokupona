import type { EventChecklistItem, Prisma } from "#prisma/generated/client";

import { prisma } from "~/db.server";
import {
  type ChecklistCategory,
  DEFAULT_CHECKLIST_ITEMS,
} from "~/features/events/checklist";

export type { EventChecklistItem };

export interface NewChecklistItem {
  label: string;
  category: ChecklistCategory;
}

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

/**
 * Positions run across the whole list, not per category: the list is grouped
 * by category when it's shown, so the next free one is the end of every
 * category at once.
 */
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

/** Appends the given items to the end of their categories. */
export async function addChecklistItemsInTx(
  tx: Prisma.TransactionClient,
  eventId: string,
  items: readonly NewChecklistItem[],
): Promise<void> {
  if (items.length === 0) return;
  const start = await nextPositionInTx(tx, eventId);
  await tx.eventChecklistItem.createMany({
    data: items.map(({ label, category }, index) => ({
      eventId,
      label,
      category,
      position: start + index,
    })),
  });
}

export async function addChecklistItem(
  eventId: string,
  item: NewChecklistItem,
): Promise<void> {
  await prisma.$transaction((tx) => addChecklistItemsInTx(tx, eventId, [item]));
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
      DEFAULT_CHECKLIST_ITEMS.filter(({ label }) => !have.has(label)),
    );
  });
}

/**
 * Rewords an item and/or moves it to another category, where it goes to the
 * end. Scoped to the event like the other changes; returns whether an item
 * was changed.
 */
export async function updateChecklistItem(
  eventId: string,
  itemId: string,
  { label, category }: NewChecklistItem,
): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    const item = await tx.eventChecklistItem.findFirst({
      where: { id: itemId, eventId },
      select: { category: true },
    });
    if (!item) return false;

    const moved = item.category !== category;
    await tx.eventChecklistItem.update({
      where: { id: itemId },
      data: {
        label,
        category,
        ...(moved ? { position: await nextPositionInTx(tx, eventId) } : {}),
      },
    });
    return true;
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
