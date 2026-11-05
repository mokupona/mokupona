import { describe, expect, it } from "vitest";

import { buildEventData } from "../../test/factories";

import {
  addChecklistItem,
  addDefaultChecklistItems,
  deleteChecklistItem,
  getChecklistForEvent,
  setChecklistItemDone,
} from "./event-checklist.server";
import {
  createEvent,
  deleteEvent,
  getEventsWithAddress,
  publishedOrNull,
  setEventPublished,
} from "./event.server";

import { prisma } from "~/db.server";
import { DEFAULT_CHECKLIST_ITEMS } from "~/features/events/checklist";

async function newEvent(published = true) {
  return createEvent({ ...(await buildEventData()), published });
}

describe("event drafts", () => {
  it("leaves drafts out of the public listing and keeps them for the admin", async () => {
    const live = await newEvent(true);
    const draft = await newEvent(false);

    const publicIds = (await getEventsWithAddress()).map((event) => event.id);
    const adminIds = (await getEventsWithAddress({ includeDrafts: true })).map(
      (event) => event.id,
    );

    expect(publicIds).toContain(live.id);
    expect(publicIds).not.toContain(draft.id);
    expect(adminIds).toEqual(expect.arrayContaining([live.id, draft.id]));
  });

  it("publishes a draft and takes it back down", async () => {
    const draft = await newEvent(false);
    expect(publishedOrNull(draft)).toBeNull();

    const published = await setEventPublished(draft.id, true);
    expect(publishedOrNull(published)).toEqual(published);

    const unpublished = await setEventPublished(draft.id, false);
    expect(unpublished.published).toBe(false);
  });

  it("creates events public unless asked for a draft", async () => {
    const event = await createEvent(await buildEventData());
    expect(event.published).toBe(true);
  });
});

describe("event checklist", () => {
  it("starts a new event with the usual items, none done", async () => {
    const event = await newEvent();

    const items = await getChecklistForEvent(event.id);

    expect(items.map((item) => item.label)).toEqual([
      ...DEFAULT_CHECKLIST_ITEMS,
    ]);
    expect(items.every((item) => item.doneAt === null)).toBe(true);
  });

  it("appends, ticks, unticks and removes items", async () => {
    const event = await newEvent();
    await addChecklistItem(event.id, "Borrow extra chairs");

    let items = await getChecklistForEvent(event.id);
    const chairs = items.at(-1)!;
    expect(chairs.label).toBe("Borrow extra chairs");

    expect(await setChecklistItemDone(event.id, chairs.id, true)).toBe(true);
    items = await getChecklistForEvent(event.id);
    expect(items.at(-1)!.doneAt).toBeInstanceOf(Date);

    await setChecklistItemDone(event.id, chairs.id, false);
    items = await getChecklistForEvent(event.id);
    expect(items.at(-1)!.doneAt).toBeNull();

    expect(await deleteChecklistItem(event.id, chairs.id)).toBe(true);
    items = await getChecklistForEvent(event.id);
    expect(items.map((item) => item.label)).not.toContain(
      "Borrow extra chairs",
    );
  });

  it("ignores an item id that belongs to another event", async () => {
    const [one, other] = await Promise.all([newEvent(), newEvent()]);
    const [item] = await getChecklistForEvent(one.id);

    expect(await setChecklistItemDone(other.id, item!.id, true)).toBe(false);
    expect(await deleteChecklistItem(other.id, item!.id)).toBe(false);
    expect((await getChecklistForEvent(one.id))[0]).toMatchObject({
      id: item!.id,
      doneAt: null,
    });
  });

  it("re-adds only the missing default items", async () => {
    const event = await newEvent();
    const [first] = await getChecklistForEvent(event.id);
    await deleteChecklistItem(event.id, first!.id);

    await addDefaultChecklistItems(event.id);
    await addDefaultChecklistItems(event.id);

    const labels = (await getChecklistForEvent(event.id)).map(
      (item) => item.label,
    );
    expect(labels).toHaveLength(DEFAULT_CHECKLIST_ITEMS.length);
    expect(new Set(labels)).toEqual(new Set(DEFAULT_CHECKLIST_ITEMS));
  });

  it("goes with its event", async () => {
    const event = await newEvent();
    await deleteEvent(event.id);

    expect(
      await prisma.eventChecklistItem.count({ where: { eventId: event.id } }),
    ).toBe(0);
  });
});
