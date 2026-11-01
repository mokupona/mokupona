import type { LiveDataTables } from "~/features/live-data/snapshot";

const at = new Date("2025-01-10T10:00:00.000Z");
const stamps = { createdAt: at, updatedAt: at };

/**
 * A small but complete live-data copy: one past event with a cover, a form
 * with one signup in each signup table, a gallery photo and a board member.
 * Ids are prefixed so several fixtures can be told apart.
 */
export function liveDataFixture(
  prefix = "live",
  { createdByEmail = null }: { createdByEmail?: string | null } = {},
): LiveDataTables {
  const id = (name: string) => `${prefix}_${name}`;

  return {
    addresses: [
      {
        id: id("address"),
        streetName: "Langstrasse",
        houseNumber: `${prefix}-1`,
        zip: "8004",
        city: "Zürich",
      },
    ],
    images: [
      {
        id: id("cover"),
        altText: "A long table",
        contentType: "image/jpeg",
        storageKey: `${prefix}-cover-key`,
        version: 11,
        width: 1200,
        height: 800,
        blurDataUrl: null,
        ...stamps,
      },
      {
        id: id("gallery"),
        altText: null,
        contentType: "image/jpeg",
        storageKey: `${prefix}-gallery-key`,
        version: 12,
        width: 900,
        height: 600,
        blurDataUrl: null,
        ...stamps,
      },
      {
        id: id("portrait"),
        altText: null,
        contentType: "image/png",
        storageKey: `${prefix}-portrait-key`,
        version: null,
        width: null,
        height: null,
        blurDataUrl: null,
        ...stamps,
      },
    ],
    forms: [{ id: id("form"), ...stamps }],
    formVersions: [
      {
        id: id("form_v1"),
        formId: id("form"),
        version: 1,
        schema: [{ key: "name", type: "text", label: "Name", required: true }],
        ...stamps,
      },
    ],
    formSubmissions: [
      {
        id: id("submission"),
        formVersionId: id("form_v1"),
        answers: { name: "Ada", email: "ada@example.com" },
        createdAt: at,
      },
    ],
    events: [
      {
        id: id("event"),
        title: "Winter table",
        description: "Soup, bread and a long evening.",
        menuDescription: null,
        donationDescription: null,
        date: new Date("2025-02-01T18:00:00.000Z"),
        slots: 12,
        price: 30,
        discounts: null,
        imageId: id("cover"),
        addressId: id("address"),
        formId: id("form"),
        createdByEmail,
      },
    ],
    eventResponses: [
      {
        id: id("response"),
        eventId: id("event"),
        name: "Grace",
        email: "grace@example.com",
        phone: "",
        vegetarian: true,
        student: null,
        restrictions: null,
        comment: null,
        ...stamps,
      },
    ],
    eventGalleryImages: [
      {
        id: id("gallery_link"),
        eventId: id("event"),
        imageId: id("gallery"),
        caption: "Dessert",
        position: 0,
        ...stamps,
      },
    ],
    boardMembers: [
      {
        id: id("board"),
        name: "Lin",
        position: "Chef",
        imageId: id("portrait"),
        ...stamps,
      },
    ],
  };
}

export const EMPTY_LIVE_DATA: LiveDataTables = {
  addresses: [],
  images: [],
  forms: [],
  formVersions: [],
  formSubmissions: [],
  events: [],
  eventResponses: [],
  eventGalleryImages: [],
  boardMembers: [],
};
