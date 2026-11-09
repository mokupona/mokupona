// @vitest-environment node
import { RouterContextProvider } from "react-router";
import { describe, expect, it } from "vitest";

import { buildEventData, createTestUser } from "../../../test/factories";

import { userContext } from "~/features/auth/middleware.server";
import { getChecklistForEvent } from "~/models/event-checklist.server";
import { createEvent } from "~/models/event.server";
import { getUserByIdWithRole } from "~/models/user.server";
import { action } from "~/routes/admin.events.$eventId";

/**
 * Posts to the event page as a moderator: the admin layout lets moderators
 * in, and the checklist is theirs to edit as much as an admin's.
 */
async function post(eventId: string, body: Record<string, string>) {
  const moderator = await createTestUser("moderator");
  const context = new RouterContextProvider();
  context.set(userContext, (await getUserByIdWithRole(moderator.id)) as never);

  return action({
    params: { eventId },
    request: new Request(`http://localhost:3000/admin/events/${eventId}`, {
      method: "POST",
      body: new URLSearchParams(body),
    }),
    context,
  } as unknown as Parameters<typeof action>[0]);
}

async function statusOf(promise: Promise<unknown>): Promise<number> {
  try {
    await promise;
    return 200;
  } catch (error) {
    if (error instanceof Response) return error.status;
    throw error;
  }
}

describe("event checklist actions", () => {
  it("adds an item to the category it was typed in", async () => {
    const event = await createEvent(await buildEventData());

    await post(event.id, {
      intent: "checklist-add",
      label: "  Buy candles  ",
      category: "decorations",
    });

    expect((await getChecklistForEvent(event.id)).at(-1)).toMatchObject({
      label: "Buy candles",
      category: "decorations",
    });
  });

  it("rewords and moves an item", async () => {
    const event = await createEvent(await buildEventData());
    const [item] = await getChecklistForEvent(event.id);

    await post(event.id, {
      intent: "checklist-update",
      itemId: item!.id,
      label: "Confirm the location and the key handover",
      category: "general",
    });

    expect(
      (await getChecklistForEvent(event.id)).find(
        (each) => each.id === item!.id,
      ),
    ).toMatchObject({
      label: "Confirm the location and the key handover",
      category: "general",
    });
  });

  it("refuses an unknown category or a blank label", async () => {
    const event = await createEvent(await buildEventData());
    const [item] = await getChecklistForEvent(event.id);

    expect(
      await statusOf(
        post(event.id, {
          intent: "checklist-add",
          label: "Buy candles",
          category: "flowers",
        }),
      ),
    ).toBe(400);
    expect(
      await statusOf(
        post(event.id, {
          intent: "checklist-update",
          itemId: item!.id,
          label: "   ",
          category: "general",
        }),
      ),
    ).toBe(400);
  });

  it("answers 404 for an item of another event", async () => {
    const [one, other] = await Promise.all([
      createEvent(await buildEventData()),
      createEvent(await buildEventData()),
    ]);
    const [item] = await getChecklistForEvent(one.id);

    expect(
      await statusOf(
        post(other.id, {
          intent: "checklist-update",
          itemId: item!.id,
          label: "Hijacked",
          category: "general",
        }),
      ),
    ).toBe(404);
  });
});
