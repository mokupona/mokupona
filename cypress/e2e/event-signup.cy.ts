import { faker } from "@faker-js/faker";

import { readLatestMailTo } from "../support/mail";
import {
  acceptPrivacyAndJoin,
  fillSignupContact,
} from "../support/upload-test-utils";

describe("event signup", () => {
  function visitFirstEvent() {
    cy.visitAndCheck("/events");
    cy.findAllByRole("link", { name: /read more/i })
      .first()
      .click();
  }

  function fillSigner(name = faker.person.fullName()) {
    fillSignupContact({
      name,
      email: `${faker.internet.username()}@example.com`,
    });
  }

  function addFriend(name: string) {
    cy.findByRole("button", { name: /add a friend/i }).click();
    cy.findAllByRole("textbox", { name: /^name$/i })
      .should("have.length", 2)
      .last()
      .type(name);
  }

  it("allows signing up for an event", () => {
    visitFirstEvent();

    fillSigner();
    acceptPrivacyAndJoin();
  });

  it("allows signing up with a friend", () => {
    visitFirstEvent();

    fillSigner();
    addFriend(faker.person.fullName());
    acceptPrivacyAndJoin();
  });

  it("emails the signer a summary of their signup", () => {
    const suffix = `${Date.now()}`;
    const email = `confirm-${suffix}@example.com`;
    const signerName = `Cypress Signer ${suffix}`;
    const friendName = `Cypress Friend ${suffix}`;

    visitFirstEvent();
    fillSignupContact({ name: signerName, email });
    addFriend(friendName);
    acceptPrivacyAndJoin();

    readLatestMailTo(email).then((mail) => {
      expect(mail.from).to.equal("moku pona <noreply@mokupona.ch>");
      expect(mail.subject).to.match(/^You're registered for /);
      expect(mail.text).to.include(`Guest 1: ${signerName} (you)`);
      expect(mail.text).to.include(`Guest 2: ${friendName}`);
      expect(mail.text).to.include(`Email: ${email}`);
      expect(mail.text).to.match(/Total for 2 people: (\d+ CHF|free)/);
    });
  });

  it("shows a new signup in the admin table and CSV export", () => {
    const suffix = `${Date.now()}`;
    const signerName = `Cypress Signer ${suffix}`;
    const friendName = `Cypress Friend ${suffix}`;

    visitFirstEvent();
    cy.location("pathname")
      .should("match", /^\/events\/[^/]+$/)
      .then((pathname) => {
        const eventId = pathname.split("/").pop();

        fillSignupContact({
          name: signerName,
          email: `signer-${suffix}@example.com`,
        });
        addFriend(friendName);
        acceptPrivacyAndJoin();

        cy.loginAsRole("moderator");

        cy.visitAndCheck(`/admin/events/${eventId}/signups`);
        cy.findByText(signerName)
          .closest("tr")
          .within(() => {
            cy.findByText("2");
          });

        cy.request(`/admin/events/${eventId}/signups.csv`).then((response) => {
          expect(response.body).to.include(signerName);
          expect(response.body).to.include(friendName);
        });
      });
  });

  it("shows validation errors for an empty submission", () => {
    visitFirstEvent();

    cy.findByRole("button", { name: /join/i }).click();

    cy.findByText("Name is required");
    cy.findByText("Email is required");
    cy.findByText("Phone number is required");
    cy.findByText("You must agree to signup");
    cy.location("pathname").should("not.equal", "/events");
  });
});
