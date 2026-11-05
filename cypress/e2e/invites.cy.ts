import { faker } from "@faker-js/faker";

import { readLatestMailTo, visitMailLink } from "../support/mail";

function createInviteToken(
  email: string,
  role: "user" | "moderator",
  expired = false,
) {
  return cy.task<string>("createInvite", { email, role, expired });
}

function createAndVisitInvite(
  email: string,
  role: "user" | "moderator",
  expired = false,
) {
  return createInviteToken(email, role, expired).then((token) => {
    cy.visit(`/invite/${token}`);
    return cy.wrap(token);
  });
}

describe("invites", () => {
  afterEach(() => {
    cy.cleanupUser();
  });

  function acceptInviteAsNewUser(name: string, password: string) {
    cy.findByRole("textbox", { name: /name/i }).type(name);
    cy.findByLabelText(/^password$/i).type(password);
    cy.findByRole("button", { name: /accept & create account/i }).click();
    cy.location("pathname").should("equal", "/admin");
  }

  it("lets an admin invite a new moderator who signs up through the link", () => {
    const invitee = {
      name: faker.person.fullName(),
      email: `${faker.internet.username()}@example.com`.toLowerCase(),
      password: faker.internet.password(),
    };
    cy.then(() => ({ email: invitee.email })).as("user");

    cy.loginAsRole("admin");
    cy.visitAndCheck("/admin/users");
    cy.findByRole("button", { name: /invite/i }).click();
    cy.findByRole("textbox", { name: /email address/i }).type(invitee.email);
    cy.findByLabelText(/moderator/i).click({ force: true });
    cy.findByRole("button", { name: /send invite/i }).click();

    cy.findByText(invitee.email);
    cy.findByText(/moderator · invited today · expires in 7 days/i);

    cy.clearCookie("better-auth.session_token");
    readLatestMailTo(invitee.email).then((mail) => {
      visitMailLink(mail, "/invite/");
    });

    cy.findByRole("heading", { name: /accept your invite/i });
    cy.findByLabelText(/email address/i).should("be.disabled");
    acceptInviteAsNewUser(invitee.name, invitee.password);
  });

  it("rejects a reused invite link", () => {
    const invitee = {
      email: `${faker.internet.username()}@example.com`.toLowerCase(),
      password: faker.internet.password(),
    };
    cy.then(() => ({ email: invitee.email })).as("user");

    createAndVisitInvite(invitee.email, "moderator").then((token) => {
      acceptInviteAsNewUser("test person", invitee.password);

      cy.clearCookie("better-auth.session_token");
      cy.visit(`/invite/${token}`);
      cy.findByRole("heading", {
        name: /this invite has already been accepted/i,
      });
    });
  });

  it("upgrades an existing logged-in user via the confirm screen", () => {
    cy.login().then((user) => {
      const { email } = user;

      createAndVisitInvite(email, "moderator").then(() => {
        cy.findByRole("heading", { name: /accept your invite/i });
        cy.findByRole("button", {
          name: /accept and become a moderator/i,
        }).click();

        cy.location("pathname").should("equal", "/admin");
      });
    });
  });

  it("dead-ends an expired invite", () => {
    const email = `${faker.internet.username()}@example.com`.toLowerCase();
    cy.then(() => ({ email })).as("user");

    createAndVisitInvite(email, "user", true).then(() => {
      cy.findByRole("heading", { name: /this invite has expired/i });
    });
  });

  it("explains a signed-in email mismatch", () => {
    cy.login().then(() => {
      const otherEmail =
        `${faker.internet.username()}@example.com`.toLowerCase();

      createAndVisitInvite(otherEmail, "user").then(() => {
        cy.findByRole("heading", {
          name: /this invite is for a different account/i,
        });
        cy.findByRole("button", { name: /log out & retry/i }).click();

        cy.findByRole("heading", { name: /accept your invite/i });
        cy.findByLabelText(/email address/i).should("be.disabled");
      });
    });
  });
});
