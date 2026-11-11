import type { LiveDataTables } from "~/features/live-data/snapshot";

const at = new Date("2025-01-10T10:00:00.000Z");
const stamps = { createdAt: at, updatedAt: at };

/**
 * A small but complete live-data copy: one past event with a cover, a form
 * with one signup in each signup table (the current one with a person ticked
 * as arrived), a gallery photo, a board member and a volunteer credited on
 * the event.
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
        // framed by an admin, which a copy must keep
        cropX: 0.1,
        cropY: 0.05,
        cropWidth: 0.75,
        cropHeight: 0.75,
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
        cropX: null,
        cropY: null,
        cropWidth: null,
        cropHeight: null,
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
        cropX: null,
        cropY: null,
        cropWidth: null,
        cropHeight: null,
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
        status: "waitlisted",
        seats: 1,
        email: "ada@example.com",
        firstHalfPaid: true,
        secondHalfPaid: false,
        adminNote: "Pays the second half by transfer in December",
        firstHalfMethod: "cash",
        secondHalfMethod: "twint",
        confirmationMarkedSent: true,
        paymentReminderSent: true,
        singlePayment: false,
        createdAt: at,
      },
    ],
    signupGuests: [
      {
        id: id("signup_guest"),
        submissionId: id("submission"),
        guestIndex: 0,
        arrivedAt: new Date("2025-02-01T18:05:00.000Z"),
        donationRappen: 750,
        donationMethod: "cash",
        ...stamps,
      },
    ],
    events: [
      {
        id: id("event"),
        title: "Winter table",
        description: "Soup, bread and a long evening.",
        menuDescription: null,
        donationDescription: null,
        recap: "Thank you for a warm evening.",
        date: new Date("2025-02-01T18:00:00.000Z"),
        slots: 12,
        published: true,
        price: 30,
        studentDiscount: 10,
        vegetarianDiscount: 5,
        discounts: null,
        confirmedMailSubject: "See you at {event}",
        confirmedMailMessage: null,
        waitlistMailSubject: null,
        waitlistMailMessage: "Fingers crossed, {name}.",
        twintFeePercent: 1.3,
        twintFeeFixedRappen: 25,
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
        bio: null,
        imageId: id("portrait"),
        ...stamps,
      },
    ],
    volunteers: [
      {
        id: id("volunteer"),
        name: "Noa",
        role: "dishes",
        bio: null,
        imageId: null,
        ...stamps,
      },
    ],
    eventVolunteers: [{ eventId: id("event"), volunteerId: id("volunteer") }],
    siteTexts: [
      {
        key: "landing.vision.headline",
        value: `${prefix}: food is how we meet`,
        defaultAtEdit: "food as a way to connect",
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
  signupGuests: [],
  events: [],
  eventResponses: [],
  eventGalleryImages: [],
  boardMembers: [],
  volunteers: [],
  eventVolunteers: [],
  siteTexts: [],
};
