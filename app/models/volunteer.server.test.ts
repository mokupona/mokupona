import { faker } from "@faker-js/faker";
import { afterEach, describe, expect, it } from "vitest";

import { buildEventData } from "../../test/factories";

import { createEvent, deleteEventsInTx } from "./event.server";
import {
  createVolunteer,
  deleteVolunteer,
  listVolunteersForEvent,
  setEventVolunteers,
  updateVolunteer,
} from "./volunteer.server";

import { prisma } from "~/db.server";
import type { ImageCreateData } from "~/models/image.server";

const eventIds: string[] = [];
const volunteerIds: string[] = [];

function portrait(marker: string): ImageCreateData {
  return {
    contentType: "image/jpeg",
    storageKey: `test/volunteers/${marker}-${faker.string.uuid()}`,
  };
}

async function makeVolunteer(name: string, image?: ImageCreateData) {
  const volunteer = await createVolunteer({
    name,
    role: "kitchen",
    ...(image && { image }),
  });
  volunteerIds.push(volunteer.id);
  return volunteer;
}

async function makeEvent() {
  const event = await createEvent(await buildEventData());
  eventIds.push(event.id);
  return event;
}

afterEach(async () => {
  const events = eventIds.splice(0);
  if (events.length > 0) {
    await prisma.$transaction((tx) =>
      deleteEventsInTx(tx, { id: { in: events } }),
    );
  }
  await prisma.volunteer.deleteMany({
    where: { id: { in: volunteerIds.splice(0) } },
  });
  await prisma.image.deleteMany({
    where: { storageKey: { startsWith: "test/volunteers/" } },
  });
});

describe("volunteer image lifecycle", () => {
  it("replaces the portrait on update and returns the old key", async () => {
    const oldImage = portrait("old");
    const volunteer = await makeVolunteer("Swap Portrait", oldImage);

    const { replacedImageKey } = await updateVolunteer(volunteer.id, {
      name: volunteer.name,
      image: portrait("new"),
    });

    expect(replacedImageKey).toBe(oldImage.storageKey);
    await expect(
      prisma.image.count({ where: { storageKey: oldImage.storageKey } }),
    ).resolves.toBe(0);
  });

  it("deletes the portrait with the volunteer and returns its key", async () => {
    const image = portrait("deleted");
    const volunteer = await makeVolunteer("Delete Portrait", image);

    const { imageKey } = await deleteVolunteer(volunteer.id);

    expect(imageKey).toBe(image.storageKey);
    await expect(
      prisma.image.count({ where: { storageKey: image.storageKey } }),
    ).resolves.toBe(0);
  });

  it("clears an empty role and bio to null", async () => {
    const volunteer = await makeVolunteer("Clear Fields");

    const { volunteer: updated } = await updateVolunteer(volunteer.id, {
      name: volunteer.name,
      role: "",
      bio: "",
    });

    expect(updated.role).toBeNull();
    expect(updated.bio).toBeNull();
  });
});

describe("event volunteers", () => {
  it("credits exactly the given volunteers, replacing the previous set", async () => {
    const event = await makeEvent();
    const a = await makeVolunteer("Volunteer A");
    const b = await makeVolunteer("Volunteer B");
    const c = await makeVolunteer("Volunteer C");

    await setEventVolunteers(event.id, [a.id, b.id]);
    expect(
      (await listVolunteersForEvent(event.id)).map(({ id }) => id),
    ).toEqual([a.id, b.id]);

    await setEventVolunteers(event.id, [c.id, c.id]);
    expect(
      (await listVolunteersForEvent(event.id)).map(({ id }) => id),
    ).toEqual([c.id]);

    await setEventVolunteers(event.id, []);
    await expect(listVolunteersForEvent(event.id)).resolves.toEqual([]);
  });

  it("drops the credit when a volunteer is deleted", async () => {
    const event = await makeEvent();
    const volunteer = await makeVolunteer("Leaving");
    await setEventVolunteers(event.id, [volunteer.id]);

    await deleteVolunteer(volunteer.id);

    await expect(listVolunteersForEvent(event.id)).resolves.toEqual([]);
  });
});
