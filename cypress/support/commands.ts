import { faker } from "@faker-js/faker";

type TestUser = { email: string };

const SESSION_COOKIE = "better-auth.session_token";

declare global {
  namespace Cypress {
    interface Chainable {
      login: typeof login;

      loginAsRole: typeof loginAsRole;

      cleanupUser: typeof cleanupUser;

      visitAndCheck: typeof visitAndCheck;
    }
  }
}

/** Signs in a brand-new user, so each test gets its own. */
function login({
  email = faker.internet.email({ provider: "example.com" }),
}: {
  email?: string;
} = {}) {
  cy.then((): TestUser => ({ email })).as("user");
  cy.task<string>("createUserSession", email).then((cookie) =>
    cy.setCookie(SESSION_COOKIE, cookie),
  );
  return cy.get<TestUser>("@user");
}

/**
 * Signs in as the seeded moderator or admin. The session is made once and
 * reused across tests and specs, and made again only when the server no
 * longer knows it (a test signed out, or the run outlived it).
 */
function loginAsRole(role: "moderator" | "admin" = "moderator") {
  cy.session(
    ["seeded-role", role],
    () => {
      cy.task<string>("createRoleSession", role).then((cookie) =>
        cy.setCookie(SESSION_COOKIE, cookie),
      );
    },
    {
      cacheAcrossSpecs: true,
      validate() {
        cy.request("/api/auth/get-session")
          .its("body")
          .should((body: { user?: { email?: string } } | null) => {
            expect(body?.user?.email, "seeded session still valid").to.equal(
              `${role}@mokupona.ch`,
            );
          });
      },
    },
  );
}

function cleanupUser({ email }: { email?: string } = {}) {
  if (email) {
    deleteUserByEmail(email);
  } else {
    cy.get<TestUser>("@user").then(({ email }) => {
      deleteUserByEmail(email);
    });
  }
  cy.clearCookie(SESSION_COOKIE);
}

function deleteUserByEmail(email: string) {
  cy.task("deleteUser", email);
  cy.clearCookie(SESSION_COOKIE);
}

/**
 * Visits a page and waits until React has hydrated it, so the test's first
 * click lands on a live page rather than the server's HTML. root.tsx marks
 * <html> once hydrated when the server runs with CYPRESS_SUPPORT=true.
 */
function visitAndCheck(url: string) {
  cy.visit(url);
  cy.location("pathname").should("contain", url);
  cy.get("html[data-cy-hydrated]");
}

export const registerCommands = () => {
  Cypress.Commands.add("login", login);
  Cypress.Commands.add("loginAsRole", loginAsRole);
  Cypress.Commands.add("cleanupUser", cleanupUser);
  Cypress.Commands.add("visitAndCheck", visitAndCheck);
};
