describe("admin site texts", () => {
  const INTRO = /our mission is to connect people through shared meals/i;

  beforeEach(() => {
    cy.loginAsRole("moderator");
  });

  it("finds a text by its wording, changes it on the site and resets it", () => {
    const wording = `we cook, we host, we wash up (${Date.now()})`;

    cy.visitAndCheck("/admin/texts");
    cy.findByPlaceholderText(/search all texts/i).type(
      "our mission is to connect people",
    );
    cy.findByRole("link", { name: /intro.*about/i }).click();
    cy.location("pathname").should("equal", "/admin/texts/about");

    cy.findByRole("textbox", { name: /^intro$/i })
      .clear()
      .type(wording);
    cy.findByRole("button", { name: /^save$/i }).click();
    cy.findByText(/1 text saved/i);

    cy.visitAndCheck("/about");
    cy.findByText(wording);
    cy.findByText(INTRO).should("not.exist");

    cy.visitAndCheck("/admin/texts/about");
    cy.get('[id="about.intro"]').within(() => {
      cy.findByRole("button", { name: /reset to default/i }).click();
    });
    cy.findByRole("button", { name: /^save$/i }).click();
    cy.findByText(/1 text saved/i);

    cy.visitAndCheck("/about");
    cy.findByText(INTRO);
  });

  it("refuses a placeholder the page can't fill and saves nothing", () => {
    cy.visitAndCheck("/admin/texts/auth");
    cy.findByRole("textbox", { name: /check your inbox: text/i })
      .clear()
      .type("sent to {{}mail}");
    cy.findByRole("button", { name: /^save$/i }).click();

    cy.findByText(/unknown placeholder \{mail\}/i);
    cy.findByText(/some texts need fixing/i);
  });
});
