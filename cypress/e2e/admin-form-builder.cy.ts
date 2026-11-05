import {
  acceptPrivacyAndJoin,
  createEventViaAdminForm,
  eventFormValues,
  fillSignupContact,
  runUploadDbCommand,
  saveEventAndCaptureId,
  uniqueSuffix,
} from "../support/upload-test-utils";

describe("admin signup form builder", () => {
  let eventsToCleanup: string[];

  beforeEach(() => {
    eventsToCleanup = [];
    cy.loginAsRole("moderator");
  });

  afterEach(() => {
    cy.then(() => {
      eventsToCleanup.forEach((id) => {
        runUploadDbCommand("delete-event", { id });
      });
    });
  });

  const RESTRICTIONS = /dietary restrictions/i;
  const LINKED_RESTRICTIONS = /dietary restrictions.*linked/i;
  const FRIEND_RESTRICTIONS = /dietary restrictions.*linked to the signer/i;
  const FRIENDS_CARD = /^friends group/i;

  function openRow(name: RegExp) {
    cy.findAllByRole("button", { name }).first().click();
  }

  function withinRow(name: RegExp, run: () => void) {
    cy.findAllByRole("button", { name }).first().closest("li").within(run);
  }

  function openLastRow(name: RegExp) {
    cy.findAllByRole("button", { name }).last().click();
  }

  function withinLastRow(name: RegExp, run: () => void) {
    cy.findAllByRole("button", { name }).last().closest("li").within(run);
  }

  function relabelSignerRestrictions(label: string) {
    openRow(RESTRICTIONS);
    withinRow(RESTRICTIONS, () => {
      cy.findByLabelText(/^label$/i)
        .clear()
        .type(label);
    });
  }

  function saveEventExpectingDetail(title: string) {
    cy.findByRole("button", { name: /^(publish|save event)$/i }).click();
    cy.findByRole("heading", { name: title }).should("be.visible");
  }

  it("authors a custom field that round-trips signup → admin table → CSV", () => {
    const suffix = uniqueSuffix();
    const values = eventFormValues(`builder-${suffix}`);
    const signerName = `Builder Signer ${suffix}`;

    createEventViaAdminForm(values);

    cy.findByRole("button", { name: /^add field$/i }).click();
    cy.findAllByLabelText(/^label$/i)
      .last()
      .type("Favorite dish")
      .blur();
    cy.findAllByLabelText(/^field key$/i)
      .last()
      .should("have.value", "favorite_dish");

    cy.findByRole("button", { name: /^add field$/i }).click();
    cy.findAllByLabelText(/^type$/i)
      .last()
      .select("select");
    cy.findAllByLabelText(/^label$/i)
      .last()
      .type("Menu choice")
      .blur();
    cy.findByLabelText(/options \(one per line\)/i).type("Meat\nVegan");

    saveEventAndCaptureId(values.title).then((eventId) => {
      eventsToCleanup.push(eventId);

      cy.visitAndCheck(`/admin/events/${eventId}/edit`);
      openRow(/favorite dish/i);
      cy.findByDisplayValue("Favorite dish").should("be.visible");
      cy.findByDisplayValue("favorite_dish").should("be.visible");

      cy.visitAndCheck(`/events/${eventId}`);
      fillSignupContact({
        name: signerName,
        email: `builder-${suffix}@example.com`,
      });
      cy.findByRole("textbox", { name: /favorite dish/i }).type("Ramen");
      cy.findByRole("combobox", { name: /menu choice/i }).select("Vegan");
      acceptPrivacyAndJoin();

      cy.visitAndCheck(`/admin/events/${eventId}/signups`);
      cy.findByText(signerName);

      cy.request(`/admin/events/${eventId}/signups.csv`).then((response) => {
        expect(response.body).to.include("Favorite dish");
        expect(response.body).to.include("Ramen");
        expect(response.body).to.include("Menu choice");
        expect(response.body).to.include("Vegan");
        expect(response.body).to.include(signerName);
      });
    });
  });

  it("versions a submitted form and exports mixed legacy + multi-version rows", () => {
    const suffix = uniqueSuffix();
    const values = eventFormValues(`builder-versions-${suffix}`);
    const legacyName = `Legacy Guest ${suffix}`;
    const v1Signer = `V1 Signer ${suffix}`;
    const v1Friend = `V1 Friend ${suffix}`;
    const v2Signer = `V2 Signer ${suffix}`;

    createEventViaAdminForm(values);
    saveEventAndCaptureId(values.title).then((eventId) => {
      eventsToCleanup.push(eventId);

      runUploadDbCommand("create-legacy-response", {
        eventId: eventId,
        name: legacyName,
      });

      cy.visitAndCheck(`/events/${eventId}`);
      fillSignupContact({
        name: v1Signer,
        email: `v1-${suffix}@example.com`,
      });
      cy.findByRole("button", { name: /add a friend/i }).click();
      cy.findAllByRole("textbox", { name: /^name$/i })
        .should("have.length", 2)
        .last()
        .type(v1Friend);
      acceptPrivacyAndJoin();

      cy.visitAndCheck(`/admin/events/${eventId}/edit`);
      cy.findAllByLabelText(/field key \(locked/i).should(
        "have.length.greaterThan",
        0,
      );
      relabelSignerRestrictions("Allergies");
      saveEventExpectingDetail(values.title);

      cy.visitAndCheck(`/events/${eventId}`);
      fillSignupContact({
        name: v2Signer,
        email: `v2-${suffix}@example.com`,
      });
      cy.findAllByRole("textbox", { name: /allergies/i })
        .first()
        .type("pollen");
      acceptPrivacyAndJoin();

      cy.visitAndCheck(`/admin/events/${eventId}/signups`);
      cy.findByText(legacyName);
      cy.findByText(v1Signer)
        .closest("tr")
        .within(() => {
          cy.findByText("2");
        });
      cy.findByText(v2Signer);

      cy.request(`/admin/events/${eventId}/signups.csv`).then((response) => {
        expect(response.body).to.include("Allergies");
        expect(response.body).to.include(legacyName);
        expect(response.body).to.include(v1Signer);
        expect(response.body).to.include(v1Friend);
        expect(response.body).to.include(v2Signer);
        expect(response.body).to.include("pollen");
      });
    });
  });

  it("edits a form and shows the change after reload", () => {
    const suffix = uniqueSuffix();
    const values = eventFormValues(`builder-edit-${suffix}`);

    createEventViaAdminForm(values);
    saveEventAndCaptureId(values.title).then((eventId) => {
      eventsToCleanup.push(eventId);

      cy.visitAndCheck(`/admin/events/${eventId}/edit`);
      relabelSignerRestrictions("Allergies");
      openRow(FRIENDS_CARD);
      cy.findByLabelText(/max per signup/i)
        .clear()
        .type("0");
      saveEventExpectingDetail(values.title);

      cy.visitAndCheck(`/admin/events/${eventId}/edit`);
      openRow(/allergies/i);
      withinRow(/allergies/i, () => {
        cy.findByLabelText(/^label$/i).should("have.value", "Allergies");
      });
      openRow(FRIENDS_CARD);
      cy.findByLabelText(/max per signup/i).should("have.value", "0");

      cy.visitAndCheck(`/events/${eventId}`);
      cy.findAllByRole("textbox", { name: /allergies/i }).should("exist");
      cy.findByRole("button", { name: /add a friend/i }).should("not.exist");
    });
  });

  it("mirrors the signer's wording onto the friend's row as it is typed", () => {
    const suffix = uniqueSuffix();
    const values = eventFormValues(`builder-mirror-${suffix}`);

    createEventViaAdminForm(values);
    saveEventAndCaptureId(values.title).then((eventId) => {
      eventsToCleanup.push(eventId);

      cy.visitAndCheck(`/admin/events/${eventId}/edit`);
      relabelSignerRestrictions("Allergies");

      openRow(FRIENDS_CARD);
      openRow(/allergies.*linked to the signer/i);
      withinRow(/allergies.*linked to the signer/i, () => {
        cy.contains("Mirrors the signer")
          .should("be.visible")
          .and("contain.text", "signer's “Allergies”");
        cy.findAllByDisplayValue("Allergies")
          .filter(":visible")
          .should("have.length", 1)
          .and("be.disabled");
      });

      saveEventExpectingDetail(values.title);

      cy.visitAndCheck(`/events/${eventId}`);
      cy.findAllByRole("textbox", { name: /allergies/i }).should(
        "have.length",
        1,
      );
      cy.findByRole("button", { name: /add a friend/i }).click();
      cy.findAllByRole("textbox", { name: /allergies/i }).should(
        "have.length",
        2,
      );
    });
  });

  it("unlinks a pair from the friend's row and links it back", () => {
    const suffix = uniqueSuffix();
    const values = eventFormValues(`builder-unlink-${suffix}`);

    createEventViaAdminForm(values);
    saveEventAndCaptureId(values.title).then((eventId) => {
      eventsToCleanup.push(eventId);

      cy.visitAndCheck(`/admin/events/${eventId}/edit`);
      openRow(FRIENDS_CARD);
      openLastRow(FRIEND_RESTRICTIONS);
      withinLastRow(FRIEND_RESTRICTIONS, () => {
        cy.findByRole("button", { name: /^unlink$/i }).click();
      });

      cy.location("pathname").should("equal", `/admin/events/${eventId}/edit`);
      cy.get("#unlink-dialog-restrictions")
        .should("be.visible")
        .within(() => {
          cy.findByRole("heading", {
            name: /unlink from the signer's question\?/i,
          }).should("be.visible");
          cy.findByLabelText(/new field key/i).should(
            "have.value",
            "restrictions_2",
          );
          cy.findByRole("button", { name: /^unlink$/i }).click();
        });

      cy.findByDisplayValue("restrictions_2").should("be.enabled");
      cy.findAllByRole("button", { name: LINKED_RESTRICTIONS }).should(
        "not.exist",
      );

      saveEventExpectingDetail(values.title);

      cy.visitAndCheck(`/admin/events/${eventId}/edit`);
      openRow(FRIENDS_CARD);
      cy.findAllByRole("button", { name: RESTRICTIONS }).should(
        "have.length",
        2,
      );
      openLastRow(RESTRICTIONS);
      withinLastRow(RESTRICTIONS, () => {
        cy.findByLabelText(/^field key$/i).should(
          "have.value",
          "restrictions_2",
        );
      });

      openRow(RESTRICTIONS);
      withinRow(RESTRICTIONS, () => {
        cy.findByRole("button", { name: /link to friends/i }).click();
      });
      cy.get("#link-dialog-restrictions")
        .should("be.visible")
        .within(() => {
          cy.findByRole("heading", {
            name: /also ask each friend this question\?/i,
          }).should("be.visible");
          cy.contains("Mirror onto")
            .should("contain.text", "“Dietary restrictions”")
            .click();
          cy.findByRole("button", { name: /link to friends/i }).click();
        });

      cy.findAllByRole("button", { name: FRIEND_RESTRICTIONS }).should(
        "have.length",
        1,
      );
      withinLastRow(FRIEND_RESTRICTIONS, () => {
        cy.contains("Mirrors the signer")
          .should("be.visible")
          .and("contain.text", "signer's “Dietary restrictions”");
      });
      cy.focused().should("contain.text", "Mirrors the signer");
    });
  });

  it("warns about collected answers when unlinking an answered pair", () => {
    const suffix = uniqueSuffix();
    const values = eventFormValues(`builder-answers-${suffix}`);
    const signerName = `Answered Signer ${suffix}`;
    const friendName = `Answered Friend ${suffix}`;

    createEventViaAdminForm(values);
    saveEventAndCaptureId(values.title).then((eventId) => {
      eventsToCleanup.push(eventId);

      cy.visitAndCheck(`/events/${eventId}`);
      fillSignupContact({
        name: signerName,
        email: `answers-${suffix}@example.com`,
      });
      cy.findByRole("button", { name: /add a friend/i }).click();
      cy.findAllByRole("textbox", { name: /^name$/i })
        .should("have.length", 2)
        .last()
        .type(friendName);
      cy.findAllByRole("textbox", { name: RESTRICTIONS })
        .should("have.length", 2)
        .each(($field) => {
          cy.wrap($field).type("nuts");
        });
      acceptPrivacyAndJoin();

      cy.visitAndCheck(`/admin/events/${eventId}/edit`);
      cy.findAllByLabelText(/field key \(locked/i).should(
        "have.length.greaterThan",
        0,
      );
      openRow(FRIENDS_CARD);
      openLastRow(FRIEND_RESTRICTIONS);
      withinLastRow(FRIEND_RESTRICTIONS, () => {
        cy.findByRole("button", { name: /^unlink$/i }).click();
      });

      cy.get("#unlink-dialog-restrictions")
        .should("be.visible")
        .within(() => {
          cy.contains(/2 answers were collected under the shared key/i).should(
            "be.visible",
          );
          cy.contains("strong", "restrictions").should("be.visible");
          cy.findByRole("button", { name: /^unlink$/i }).click();
        });

      cy.findByDisplayValue("restrictions_2")
        .should("be.enabled")
        .and("not.have.attr", "readonly");

      openRow(RESTRICTIONS);
      withinRow(RESTRICTIONS, () => {
        cy.findByRole("button", { name: /link to friends/i }).click();
      });
      cy.get("#link-dialog-restrictions")
        .should("be.visible")
        .within(() => {
          cy.contains(/1 friend has already answered this question/i).should(
            "be.visible",
          );
          cy.contains("Mirror onto").click();
          cy.contains(/friend has already answered/i).should("not.exist");
          cy.findByRole("button", { name: /link to friends/i }).click();
        });

      const confirms: string[] = [];
      cy.on("window:confirm", (message) => {
        confirms.push(message);
        return false;
      });
      withinLastRow(FRIEND_RESTRICTIONS, () => {
        cy.findByRole("button", { name: /^remove$/i }).click();
      });
      cy.then(() => {
        expect(confirms).to.have.length(1);
        expect(confirms[0]).to.match(/already has signups/i);
      });
      cy.findAllByRole("button", { name: FRIEND_RESTRICTIONS }).should(
        "have.length",
        1,
      );
    });
  });

  it("keeps the session's wording on the friend when the signer row is removed", () => {
    const suffix = uniqueSuffix();
    const values = eventFormValues(`builder-keep-${suffix}`);

    createEventViaAdminForm(values);
    saveEventAndCaptureId(values.title).then((eventId) => {
      eventsToCleanup.push(eventId);

      cy.visitAndCheck(`/admin/events/${eventId}/edit`);
      relabelSignerRestrictions("Allergies");
      withinRow(/allergies/i, () => {
        cy.findByRole("button", { name: /^remove$/i }).click();
      });

      openRow(FRIENDS_CARD);
      withinLastRow(/allergies/i, () => {
        cy.findByRole("button", { name: /toggle details/i }).then(($button) => {
          if ($button.attr("data-panel-open") === undefined)
            cy.wrap($button).click();
        });
        cy.findByLabelText(/^label$/i)
          .should("have.value", "Allergies")
          .and("be.enabled");
        cy.findByLabelText(/^field key$/i).should("have.value", "restrictions");
      });
    });
  });
});
