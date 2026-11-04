import {
  createEventViaAdminForm,
  eventFormValues,
  expectHandlerLimitRejection,
  FILE_TOO_LARGE_ERROR,
  fillEventForm,
  getFirstAddressId,
  oversizedZodUpload,
  runUploadDbCommand,
  saveEventAndCaptureId,
  uploadEventCover,
  VALID_UPLOAD_FIXTURE_PATH,
  type EventRecord,
  type ImageRecord,
} from "../support/upload-test-utils";

describe("admin event uploads", () => {
  let eventIdsToCleanup: string[];

  function createEventAndOpenEdit(record: {
    title: string;
    description?: string;
  }) {
    return runUploadDbCommand<EventRecord>("create-event", record).then(
      (event) => {
        eventIdsToCleanup.push(event.id);

        cy.visitAndCheck(`/admin/events/${event.id}/edit`);
        return cy.wrap(event);
      },
    );
  }

  function saveEditAndFetch(id: string) {
    cy.findByRole("button", { name: /save event/i }).click();
    cy.location("pathname").should("eq", `/admin/events/${id}`);

    return runUploadDbCommand<EventRecord>("get-event", { id });
  }

  function submitOversizedCoverExpectingError(pathname: string) {
    uploadEventCover(oversizedZodUpload(), { crop: false });
    cy.findByRole("button", { name: /save event/i }).click();

    cy.findByText(FILE_TOO_LARGE_ERROR).should("be.visible");
    cy.location("pathname").should("eq", pathname);
  }

  beforeEach(() => {
    eventIdsToCleanup = [];
    cy.loginAsRole("moderator");
  });

  afterEach(() => {
    cy.then(() => {
      eventIdsToCleanup.forEach((id) => {
        runUploadDbCommand("delete-event", { id });
      });
    });
  });

  it("creates an event with a valid uploaded cover", () => {
    const values = eventFormValues("new-success");

    createEventViaAdminForm(values);
    saveEventAndCaptureId(values.title).then((eventId) => {
      eventIdsToCleanup.push(eventId);

      runUploadDbCommand<EventRecord>("get-event", { id: eventId }).then(
        (event) => {
          expect(event.title).to.equal(values.title);
          expect(event.imageId).to.be.a("string").and.not.be.empty;
          expect(event.imageStorageKey).to.be.a("string").and.not.be.empty;
          cy.request(`/file/${event.imageId}`).its("status").should("eq", 200);
        },
      );
    });
  });

  it("shows a validation error when the uploaded cover is larger than the Zod limit", () => {
    const values = eventFormValues("new-zod-error");

    cy.visitAndCheck("/admin/events/new");
    fillEventForm(values);
    submitOversizedCoverExpectingError("/admin/events/new");
  });

  it("returns a server-side error when the uploaded cover exceeds the upload handler limit", () => {
    const values = eventFormValues("new-handler-error");

    cy.visitAndCheck("/admin/events/new");
    getFirstAddressId().then((addressId) => {
      expectHandlerLimitRejection({
        action: "/admin/events/new",
        fields: {
          ...values,
          addressId,
        },
        fileFieldName: "cover",
      });
    });
  });

  it("updates non-file fields without overriding the existing event image", () => {
    createEventAndOpenEdit({
      title: "Event edit keep image",
      description: "Original event description",
    }).then((event) => {
      const updatedTitle = "Event edit keep image updated";

      cy.findByLabelText(/^title$/i)
        .clear()
        .type(updatedTitle);
      saveEditAndFetch(event.id).then((updatedEvent) => {
        expect(updatedEvent.title).to.equal(updatedTitle);
        expect(updatedEvent.imageId).to.equal(event.imageId);
      });
    });
  });

  it("replaces the event image when a new cover is uploaded during edit", () => {
    createEventAndOpenEdit({
      title: "Event edit replace image",
      description: "Original event description",
    }).then((event) => {
      const updatedTitle = "Event edit replace image updated";

      cy.findByLabelText(/^title$/i)
        .clear()
        .type(updatedTitle);
      uploadEventCover(VALID_UPLOAD_FIXTURE_PATH);
      saveEditAndFetch(event.id).then((updatedEvent) => {
        expect(updatedEvent.title).to.equal(updatedTitle);
        expect(updatedEvent.imageId).to.not.equal(event.imageId);
        runUploadDbCommand<ImageRecord | null>("get-image", {
          id: event.imageId,
        }).then((oldImage) => {
          expect(oldImage).to.equal(null);
        });
      });
    });
  });

  it("shows a validation error on event edit when the uploaded cover is larger than the Zod limit", () => {
    createEventAndOpenEdit({ title: "Event edit zod error" }).then((event) => {
      submitOversizedCoverExpectingError(`/admin/events/${event.id}/edit`);
    });
  });

  it("returns a server-side error on event edit when the uploaded cover exceeds the upload handler limit", () => {
    createEventAndOpenEdit({ title: "Event edit handler error" }).then(
      (event) => {
        expectHandlerLimitRejection({
          action: `/admin/events/${event.id}/edit`,
          fields: {
            title: event.title,
            description: event.description,
            menuDescription: event.menuDescription ?? "",
            donationDescription: event.donationDescription ?? "",
            date: event.date.slice(0, 16),
            slots: String(event.slots),
            price: String(event.price),
            discounts: event.discounts ?? "",
            addressId: event.addressId,
          },
          fileFieldName: "cover",
        });
      },
    );
  });
});
