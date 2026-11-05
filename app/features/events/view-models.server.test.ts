import { describe, expect, it } from "vitest";

import { toEventCardModel, toEventDetailModel } from "./view-models.server";

const event = {
  id: "event-id",
  title: "Summer Event",
  description: "Event description",
  menuDescription: "Seasonal menu",
  donationDescription: "Pay what you can",
  date: new Date("2026-07-12T17:30:00.000Z"),
  slots: 12,
  published: true,
  price: 30,
  studentDiscount: 10,
  vegetarianDiscount: 5,
  discounts: "Student discount",
  confirmedMailSubject: null,
  confirmedMailMessage: null,
  waitlistMailSubject: null,
  waitlistMailMessage: null,
  image: {
    id: "image-id",
    storageKey: "abc123",
    version: 7,
    width: 1200,
    height: 800,
    blurDataUrl: "data:image/webp;base64,tiny",
  },
  imageId: "image-id",
  addressId: "address-id",
  createdById: "user-id",
  formId: "form-id",
  galleryImageCount: 4,
  address: {
    id: "address-id",
    streetName: "Example Street",
    houseNumber: "4",
    zip: "8003",
    city: "Zürich",
  },
};

describe("event view-model mapping", () => {
  it("shares summary fields while preserving each view's address casing", () => {
    const card = toEventCardModel(event);
    const detail = toEventDetailModel(event);

    expect(card).toEqual({
      id: event.id,
      title: event.title,
      description: event.description,
      date: event.date,
      image: event.image,
      price: event.price,
      slots: event.slots,
      published: true,
      addressLine: "8003 zürich",
      galleryImageCount: 4,
    });

    // the gallery count is a card-only concern — the detail view never shows it
    const { galleryImageCount, ...sharedSummary } = card;
    expect(detail).toMatchObject({
      ...sharedSummary,
      addressLine: "8003 Zürich",
      descriptionHtml: "<p>Event description</p>",
      menuHtml: "<p>Seasonal menu</p>",
      donationHtml: "<p>Pay what you can</p>",
      discountsHtml: "<p>Student discount</p>",
      studentDiscount: 10,
      vegetarianDiscount: 5,
    });
    expect(detail).not.toHaveProperty("galleryImageCount");
  });

  it("renders the event texts from Markdown, and strips it for the card", () => {
    const withMarkdown = {
      ...event,
      description: "Book at [our site](https://mokupona.ch), **soon**.",
      menuDescription: "  ",
      donationDescription: null,
    };

    expect(toEventCardModel(withMarkdown).description).toBe(
      "Book at our site, soon.",
    );

    const detail = toEventDetailModel(withMarkdown);
    expect(detail.description).toBe("Book at our site, soon.");
    expect(detail.descriptionHtml).toContain(
      '<a href="https://mokupona.ch" target="_blank" rel="noopener noreferrer">our site</a>',
    );
    expect(detail.menuHtml).toBeNull();
    expect(detail.donationHtml).toBeNull();
  });
});
