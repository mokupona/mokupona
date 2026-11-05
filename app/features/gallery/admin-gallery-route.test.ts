import type { SubmissionResult } from "@conform-to/react";
import { RouterContextProvider } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { buildEventData } from "../../../test/factories";

import { createEvent } from "~/models/event.server";
import type * as GalleryServer from "~/models/gallery.server";
import { getGalleryEntriesForEvent } from "~/models/gallery.server";
import { action } from "~/routes/admin.gallery";

const mocks = vi.hoisted(() => ({
  storeImages: vi.fn(),
  destroyImages: vi.fn(async () => {}),
  createGalleryImagesForEvent: vi.fn(),
}));

vi.mock("~/features/images/image-storage.server", () => ({
  storeImages: mocks.storeImages,
  destroyImages: mocks.destroyImages,
}));

vi.mock("~/models/gallery.server", async (importOriginal) => {
  const original = await importOriginal<typeof GalleryServer>();

  return {
    ...original,
    createGalleryImagesForEvent: mocks.createGalleryImagesForEvent,
  };
});

function photo(name: string) {
  return new File(["not really a jpeg"], name, { type: "image/jpeg" });
}

function stored(storageKey: string): PromiseSettledResult<{
  storageKey: string;
}> {
  return { status: "fulfilled", value: { storageKey } };
}

function unstored(message: string): PromiseSettledResult<never> {
  return { status: "rejected", reason: new Error(message) };
}

async function upload(eventId: string, files: File[]) {
  const body = new FormData();
  body.append("intent", "upload");
  body.append("eventId", eventId);
  body.append("caption", "A long table");
  for (const file of files) body.append("images", file);

  return action({
    params: {},
    request: new Request("http://localhost:3000/admin/gallery", {
      method: "POST",
      body,
    }),
    context: new RouterContextProvider(),
  } as unknown as Parameters<typeof action>[0]);
}

async function createTestEvent() {
  const event = await createEvent(await buildEventData());
  return event.id;
}

beforeEach(() => {
  mocks.storeImages.mockReset();
  mocks.destroyImages.mockClear();
  mocks.createGalleryImagesForEvent.mockReset();
});

describe("admin gallery upload", () => {
  it("keeps the photos that stored and names the ones that did not", async () => {
    const { createGalleryImagesForEvent } = await vi.importActual<
      typeof GalleryServer
    >("~/models/gallery.server");
    mocks.createGalleryImagesForEvent.mockImplementation(
      createGalleryImagesForEvent,
    );
    mocks.storeImages.mockResolvedValue([
      stored("event-gallery/one"),
      unstored("cloudinary 503"),
      stored("event-gallery/three"),
    ]);

    const eventId = await createTestEvent();

    const result = (await upload(eventId, [
      photo("one.jpg"),
      photo("two.jpg"),
      photo("three.jpg"),
    ])) as SubmissionResult;

    expect(result).not.toBeInstanceOf(Response);
    expect(result.error?.images).toEqual([
      "Uploaded 2 of 3 photos — two.jpg failed. Try those again.",
    ]);

    const entries = await getGalleryEntriesForEvent(eventId);
    expect(entries.map((entry) => entry.image.storageKey)).toEqual([
      "event-gallery/one",
      "event-gallery/three",
    ]);
    expect(entries.every((entry) => entry.caption === "A long table")).toBe(
      true,
    );
    expect(mocks.destroyImages).not.toHaveBeenCalled();
  });

  it("says so plainly when nothing stored at all", async () => {
    mocks.createGalleryImagesForEvent.mockResolvedValue([]);
    mocks.storeImages.mockResolvedValue([
      unstored("cloudinary 503"),
      unstored("cloudinary 503"),
    ]);

    const eventId = await createTestEvent();

    const result = (await upload(eventId, [
      photo("one.jpg"),
      photo("two.jpg"),
    ])) as SubmissionResult;

    expect(result.error?.images).toEqual([
      "None of the 2 photos could be stored — one.jpg and two.jpg failed. Try again.",
    ]);
    expect(await getGalleryEntriesForEvent(eventId)).toEqual([]);
  });

  it("destroys the batch when the rows cannot be written", async () => {
    mocks.createGalleryImagesForEvent.mockRejectedValue(
      new Error("foreign key constraint failed"),
    );
    mocks.storeImages.mockResolvedValue([
      stored("event-gallery/one"),
      stored("event-gallery/two"),
    ]);

    const eventId = await createTestEvent();

    await expect(
      upload(eventId, [photo("one.jpg"), photo("two.jpg")]),
    ).rejects.toThrow("foreign key constraint failed");

    expect(mocks.destroyImages).toHaveBeenCalledWith([
      "event-gallery/one",
      "event-gallery/two",
    ]);
  });

  it("redirects when every photo stored", async () => {
    mocks.createGalleryImagesForEvent.mockResolvedValue([]);
    mocks.storeImages.mockResolvedValue([stored("event-gallery/one")]);

    const eventId = await createTestEvent();

    const result = await upload(eventId, [photo("one.jpg")]);

    expect(result).toBeInstanceOf(Response);
    expect((result as Response).status).toBe(302);
    expect((result as Response).headers.get("location")).toBe(
      `/admin/gallery?event=${eventId}`,
    );
  });
});
