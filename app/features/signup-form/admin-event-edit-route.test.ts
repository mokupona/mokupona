import { RouterContextProvider } from "react-router";
import { describe, expect, it } from "vitest";

import { buildEventData, createTestUser } from "../../../test/factories";

import { defaultBuilderRows } from "./builder";
import type { BuilderItemRow, BuilderRow } from "./builder";

import { prisma } from "~/db.server";
import type { ValidatedUser } from "~/features/auth/guards.server";
import { userContext } from "~/features/auth/middleware.server";
import { parseStoredFormSchema } from "~/features/forms/serialization";
import { createEvent } from "~/models/event.server";
import { getCurrentFormVersionForEvent } from "~/models/form.server";
import { action } from "~/routes/admin.events.$eventId_.edit";

const SIGNER_LABEL = "Allergies";
const FRIEND_LABEL = "Dietary restrictions";

async function createTestEvent() {
  const data = await buildEventData();
  const event = await createEvent(data);

  return { eventId: event.id, addressId: data.addressId };
}

async function moderator(): Promise<ValidatedUser> {
  const user = await createTestUser("moderator");

  return prisma.user.findUniqueOrThrow({
    where: { id: user.id },
    include: { role: true },
  }) as Promise<ValidatedUser>;
}

function appendRow(
  body: URLSearchParams,
  prefix: string,
  row: BuilderRow | BuilderItemRow,
) {
  body.append(`${prefix}.type`, row.type);
  body.append(`${prefix}.name`, row.name);
  body.append(`${prefix}.label`, row.label);
  if (row.required) body.append(`${prefix}.required`, "on");
  if (row.description) body.append(`${prefix}.description`, row.description);
  if (row.options) body.append(`${prefix}.options`, row.options);

  if (row.type !== "list") return;

  body.append(`${prefix}.maxCount`, String(row.maxCount ?? 0));
  (row.itemFields ?? []).forEach((item, index) =>
    appendRow(body, `${prefix}.itemFields[${index}]`, item),
  );
}

function editBody(addressId: string, rows: BuilderRow[]): URLSearchParams {
  const body = new URLSearchParams({
    title: "An event with a linked question",
    description: "Every seat comes with a question asked twice.",
    date: "2026-09-01T18:30",
    slots: "10",
    price: "20",
    addressId,
  });

  rows.forEach((row, index) => appendRow(body, `signupForm[${index}]`, row));

  return body;
}

function disagreeingRows(): BuilderRow[] {
  return defaultBuilderRows().map((row): BuilderRow => {
    if (row.type !== "list" && row.name === "restrictions") {
      return { ...row, label: SIGNER_LABEL };
    }

    if (row.type !== "list") return row;

    return {
      ...row,
      itemFields: (row.itemFields ?? []).map((item) =>
        item.name === "restrictions" ? { ...item, label: FRIEND_LABEL } : item,
      ),
    };
  });
}

async function submit(
  eventId: string,
  body: URLSearchParams,
  user: ValidatedUser,
) {
  const context = new RouterContextProvider();
  context.set(userContext, user);

  return action({
    params: { eventId },
    request: new Request(`http://localhost:3000/admin/events/${eventId}/edit`, {
      method: "POST",
      body,
    }),
    context,
  } as unknown as Parameters<typeof action>[0]);
}

async function storedFields(eventId: string) {
  const version = await getCurrentFormVersionForEvent(eventId);
  const parsed = parseStoredFormSchema(version?.schema);
  if (!parsed.success) throw new Error("the stored form schema does not parse");

  return parsed.data;
}

describe("admin event edit action", () => {
  it("stores the signer's wording on both sides of a linked pair", async () => {
    const { eventId, addressId } = await createTestEvent();

    const result = await submit(
      eventId,
      editBody(addressId, disagreeingRows()),
      await moderator(),
    );

    expect(result).toBeInstanceOf(Response);
    expect((result as Response).status).toBe(302);

    const fields = await storedFields(eventId);
    const signer = fields.find(
      (field) => field.type !== "list" && field.data.name === "restrictions",
    );
    const friends = fields.find((field) => field.type === "list");
    const friend = friends?.data.itemFields.find(
      (item) => item.data.name === "restrictions",
    );

    expect(signer?.data.label).toBe(SIGNER_LABEL);
    expect(friend?.data.label).toBe(SIGNER_LABEL);
    expect(fields).not.toContainEqual(
      expect.objectContaining({
        data: expect.objectContaining({ label: FRIEND_LABEL }),
      }),
    );
  });

  it("splits the pair into two questions once the friend's key differs", async () => {
    const { eventId, addressId } = await createTestEvent();
    const rows = disagreeingRows().map((row): BuilderRow => {
      if (row.type !== "list") return row;

      return {
        ...row,
        itemFields: (row.itemFields ?? []).map((item) =>
          item.name === "restrictions"
            ? { ...item, name: "restrictions_2" }
            : item,
        ),
      };
    });

    await submit(eventId, editBody(addressId, rows), await moderator());

    const fields = await storedFields(eventId);
    const friends = fields.find((field) => field.type === "list");
    const unlinked = friends?.data.itemFields.find(
      (item) => item.data.name === "restrictions_2",
    );

    expect(unlinked?.data.label).toBe(FRIEND_LABEL);
  });

  it("frames the current cover anew without a new file", async () => {
    const { eventId, addressId } = await createTestEvent();
    const before = await prisma.event.findUniqueOrThrow({
      where: { id: eventId },
      include: { image: true },
    });
    const body = editBody(addressId, defaultBuilderRows());
    body.set("coverCrop", "0.1 0.2 0.5 0.4");

    const result = await submit(eventId, body, await moderator());

    expect((result as Response).status).toBe(302);
    const after = await prisma.event.findUniqueOrThrow({
      where: { id: eventId },
      include: { image: true },
    });
    // the same file, now framed
    expect(after.imageId).toBe(before.imageId);
    expect(after.image).toMatchObject({
      storageKey: before.image?.storageKey,
      cropX: 0.1,
      cropY: 0.2,
      cropWidth: 0.5,
      cropHeight: 0.4,
    });
  });

  it("leaves the cover's framing alone when the form doesn't touch it", async () => {
    const { eventId, addressId } = await createTestEvent();
    const event = await prisma.event.findUniqueOrThrow({
      where: { id: eventId },
    });
    await prisma.image.update({
      where: { id: event.imageId! },
      data: { cropX: 0, cropY: 0, cropWidth: 0.5, cropHeight: 0.5 },
    });

    await submit(
      eventId,
      editBody(addressId, defaultBuilderRows()),
      await moderator(),
    );

    expect(
      await prisma.image.findUniqueOrThrow({ where: { id: event.imageId! } }),
    ).toMatchObject({ cropWidth: 0.5, cropHeight: 0.5 });
  });
});
