import { describe, expect, it } from "vitest";

import { action, compose, details, note, paragraph } from "./compose";
import { mailTemplates, type SignupConfirmationProps } from "./templates";

import { createText, defaultText } from "~/features/site-text/text";

const OPTIONS = { linkFallback: "Link broken? Paste this:" };

describe("compose", () => {
  it("renders one set of blocks into both text and html", () => {
    const body = compose(
      "Subject",
      [
        paragraph("First line."),
        action("Do the thing", "https://example.com/go?token=abc"),
        note("Ignore this if it wasn't you."),
      ],
      OPTIONS,
    );

    expect(body.subject).toBe("Subject");
    expect(body.text).toBe(
      [
        "First line.",
        "",
        "https://example.com/go?token=abc",
        "",
        "Ignore this if it wasn't you.",
      ].join("\n"),
    );
    expect(body.html).toContain("<p>First line.</p>");
    expect(body.html).toContain(
      '<a href="https://example.com/go?token=abc">Do the thing</a>',
    );
    expect(body.html).toContain("Ignore this if it wasn&#39;t you.");
  });

  it("leaves the action URL bare on its own line in text, for Cypress", () => {
    const { text } = compose(
      "Subject",
      [paragraph("Click:"), action("Go", "https://example.com/invite/tok")],
      OPTIONS,
    );

    const links = text.match(/https?:\/\/[^\s"'<>)]+/g);
    expect(links).toEqual(["https://example.com/invite/tok"]);
  });

  it("repeats the action URL as a copy-paste fallback in html", () => {
    const { html } = compose(
      "Subject",
      [action("Go", "https://example.com/invite/tok")],
      OPTIONS,
    );

    expect(html).toContain(OPTIONS.linkFallback);
    expect(html?.match(/https:\/\/example\.com\/invite\/tok/g)).toHaveLength(2);
  });

  it("escapes interpolated content instead of trusting the caller", () => {
    const { html, text } = compose(
      "Subject",
      [paragraph('<script>alert("x")</script> & co')],
      OPTIONS,
    );

    expect(html).toContain(
      "<p>&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; co</p>",
    );
    expect(html).not.toContain("<script>");
    expect(text).toContain('<script>alert("x")</script> & co');
  });

  it("renders details as a titled list of label/value rows", () => {
    const { html, text } = compose(
      "Subject",
      [
        details("Guest 1: Ada", [
          ["Vegetarian", "yes"],
          ["Restrictions", "<none>"],
        ]),
      ],
      OPTIONS,
    );

    expect(text).toBe("Guest 1: Ada\nVegetarian: yes\nRestrictions: <none>");
    expect(html).toContain("<strong>Guest 1: Ada</strong>");
    expect(html).toMatch(/<td[^>]*>Vegetarian<\/td><td[^>]*>yes<\/td>/);
    expect(html).toContain("&lt;none&gt;");
  });

  it("keeps line breaks inside a paragraph in html", () => {
    const { html } = compose("Subject", [paragraph("one\ntwo <b>")], OPTIONS);

    expect(html).toContain("<p>one<br>two &lt;b&gt;</p>");
  });

  it("rejects action links that aren't http(s)", () => {
    expect(() =>
      compose("Subject", [action("Go", "javascript:alert(1)")], OPTIONS),
    ).toThrow(/must be http\(s\)/);

    expect(() =>
      compose("Subject", [action("Go", "/relative")], OPTIONS),
    ).toThrow(/must be an absolute URL/);
  });
});

describe("mailTemplates", () => {
  const url = "https://mokupona.ch/verify?token=t";

  it.each(["verifyEmail", "resetPassword"] as const)(
    "%s carries the link in both text and html",
    (name) => {
      const body = mailTemplates[name]({ url }, defaultText);

      expect(body.subject).toBeTruthy();
      expect(body.text).toContain(url);
      expect(body.html).toContain(url);
    },
  );

  it("names the role in the invite copy only for moderators", () => {
    const moderator = mailTemplates.invite(
      { url, roleName: "moderator" },
      defaultText,
    );
    const user = mailTemplates.invite({ url, roleName: "user" }, defaultText);

    expect(moderator.text).toContain("as a moderator");
    expect(moderator.html).toContain("as a moderator");
    expect(user.text).not.toContain("moderator");
    expect(user.text).toContain("You've been invited to join moku pona.");
  });
});

describe("signupConfirmation", () => {
  function props(
    event: Partial<SignupConfirmationProps["event"]> = {},
    status: SignupConfirmationProps["status"] = "confirmed",
  ): SignupConfirmationProps {
    return {
      status,
      event: {
        title: "Winter table",
        date: new Date("2026-11-14T18:00:00.000Z"),
        url: "https://mokupona.ch/events/evt",
        mailSubject: null,
        mailMessage: null,
        ...event,
      },
      booking: {
        guests: [
          {
            name: "Ada",
            isStudent: false,
            vegetarian: true,
            price: 45,
            email: null,
            rows: [["Vegan / Vegetarian", "yes"]],
          },
          {
            name: "Grace <3",
            isStudent: true,
            vegetarian: false,
            price: 30,
            email: null,
            rows: [["Vegan / Vegetarian", "no"]],
          },
        ],
        contact: [["Email", "ada@example.com"]],
        total: 75,
      },
    };
  }

  it("uses the default copy for a confirmed seat when the event has none", () => {
    const { subject, text } = mailTemplates.signupConfirmation(
      props(),
      defaultText,
    );

    expect(subject).toBe("Your seat for Winter table is confirmed");
    expect(text).toContain("Hi Ada,");
    expect(text).toContain(
      "your seat for Winter table on Saturday 14 November, 19:00 is confirmed.",
    );
    expect(text).toContain("Price\nAda: 45 CHF");
  });

  it("tells a waitlisted signup they're waiting, with the waitlist copy", () => {
    const { subject, text } = mailTemplates.signupConfirmation(
      props({ mailSubject: null }, "waitlisted"),
      defaultText,
    );

    expect(subject).toBe("You're on the waiting list for Winter table");
    expect(text).toContain("so you're on the waiting list.");
    expect(text).toContain("We'll email you as soon as a seat is yours.");
    expect(text).toContain("Price once you have a seat\nAda: 45 CHF");
  });

  it("lists every guest's answers, the contact details and the prices", () => {
    const { text, html } = mailTemplates.signupConfirmation(
      props(),
      defaultText,
    );

    expect(text).toContain("Guest 1: Ada (you)\nVegan / Vegetarian: yes");
    expect(text).toContain("Guest 2: Grace <3\nVegan / Vegetarian: no");
    expect(text).toContain("Your details\nEmail: ada@example.com");
    expect(text).toContain(
      "Price\nAda: 45 CHF\nGrace <3 (student): 30 CHF\nTotal for 2 people: 75 CHF",
    );
    expect(text).toContain("https://mokupona.ch/events/evt");
    expect(html).toContain("Guest 2: Grace &lt;3");
    expect(html).not.toContain("Grace <3");
  });

  it("fills the event's own subject and message, paragraph by paragraph", () => {
    const { subject, text, html } = mailTemplates.signupConfirmation(
      props({
        mailSubject: "  {name}, your {guests} seats at {event}\n",
        mailMessage: "Dear {name},\r\n\r\nyou owe us {total}.\r\nCash only.",
      }),
      defaultText,
    );

    expect(subject).toBe("Ada, your 2 seats at Winter table");
    expect(text.startsWith("Dear Ada,\n\nyou owe us 75 CHF.\nCash only.")).toBe(
      true,
    );
    expect(html).toContain("<p>Dear Ada,</p>");
    expect(html).toContain("<p>you owe us 75 CHF.<br>\nCash only.</p>");
  });

  it("renders the message's Markdown, with link addresses in the text part", () => {
    const { text, html } = mailTemplates.signupConfirmation(
      props({
        mailMessage:
          "Hi {name},\n\nread **the house rules** on [our site](https://mokupona.ch/rules) before you come.",
      }),
      defaultText,
    );

    expect(html).toContain(
      '<p>read <strong>the house rules</strong> on <a href="https://mokupona.ch/rules" target="_blank" rel="noopener noreferrer">our site</a> before you come.</p>',
    );
    expect(
      text.startsWith(
        "Hi Ada,\n\nread the house rules on our site (https://mokupona.ch/rules) before you come.",
      ),
    ).toBe(true);
    // the inbox preview is the first paragraph, as plain text
    expect(html).toContain(
      '<span style="display: none; max-height: 0; overflow: hidden;">Hi Ada,</span>',
    );
  });

  it("fills in a guest's name as plain text, never as markup", () => {
    const booking = props().booking;
    const { text, html } = mailTemplates.signupConfirmation(
      {
        ...props({ mailMessage: "Hi {name}!" }),
        booking: {
          ...booking,
          guests: [
            {
              ...booking.guests[0],
              name: "[Ada](https://evil.example) **<b>**",
            },
            ...booking.guests.slice(1),
          ],
        },
      },
      defaultText,
    );

    expect(html).toContain(
      "<p>Hi [Ada](https://evil.example) **&lt;b&gt;**!</p>",
    );
    expect(html).not.toContain('evil.example"');
    expect(text.startsWith("Hi [Ada](https://evil.example) **<b>**!")).toBe(
      true,
    );
  });

  it("falls back to the default copy for blank fields", () => {
    const { subject } = mailTemplates.signupConfirmation(
      props({ mailSubject: "   ", mailMessage: "" }),
      defaultText,
    );

    expect(subject).toBe("Your seat for Winter table is confirmed");
  });
});

describe("mail copy from the site texts", () => {
  it("sends the admin's wording, falling back to the defaults elsewhere", () => {
    const t = createText({
      "emails.verify.subject": "Bitte bestätige deine Adresse",
      "emails.linkFallback": "Klappt der Knopf nicht?",
    });

    const body = mailTemplates.verifyEmail(
      { url: "https://mokupona.ch/verify?token=t" },
      t,
    );

    expect(body.subject).toBe("Bitte bestätige deine Adresse");
    expect(body.text).toContain(defaultText("emails.verify.welcome"));
    expect(body.html).toContain("Klappt der Knopf nicht?");
  });

  it("uses the site-wide signup copy for events without their own", () => {
    const t = createText({
      "emails.signup.confirmedSubject": "Platz für {name} bei {event}",
    });

    const { subject } = mailTemplates.signupConfirmation(
      {
        status: "confirmed",
        event: {
          title: "Winter table",
          date: new Date("2026-11-14T18:00:00.000Z"),
          url: "https://mokupona.ch/events/evt",
          mailSubject: null,
          mailMessage: null,
        },
        booking: {
          guests: [
            {
              name: "Ada",
              isStudent: false,
              vegetarian: false,
              price: 45,
              email: null,
              rows: [],
            },
          ],
          contact: [],
          total: 45,
        },
      },
      t,
    );

    expect(subject).toBe("Platz für Ada bei Winter table");
  });
});

describe("friendSignup", () => {
  const event = {
    title: "Winter table",
    date: new Date("2026-11-14T18:00:00.000Z"),
    url: "https://mokupona.ch/events/evt",
  };
  const grace = {
    name: "Grace",
    isStudent: true,
    price: 30,
    email: "grace@example.com",
    vegetarian: false,
    rows: [["Vegan / Vegetarian", "no"] as const],
  };

  it("tells the friend who signed them up, and what they pay", () => {
    const { subject, text } = mailTemplates.friendSignup(
      { status: "confirmed", signer: "Ada", event, guest: grace },
      defaultText,
    );

    expect(subject).toBe("Ada signed you up for Winter table");
    expect(text).toContain("Hi Grace,");
    expect(text).toContain(
      "Ada signed you up for Winter table on Saturday 14 November, 19:00. Your seat is confirmed.",
    );
    expect(text).toContain("Your price: 30 CHF.");
    expect(text).toContain("Your details\nVegan / Vegetarian: no");
    expect(text).toContain(event.url);
  });

  it("says so when the friend is on the waiting list", () => {
    const { subject, text } = mailTemplates.friendSignup(
      { status: "waitlisted", signer: "Ada", event, guest: grace },
      defaultText,
    );

    expect(subject).toBe("Ada signed you up for Winter table: waiting list");
    expect(text).toContain("so you're on the waiting list.");
  });

  it("doesn't list the rest of the party or the signer's contact details", () => {
    const { text } = mailTemplates.friendSignup(
      { status: "confirmed", signer: "Ada", event, guest: grace },
      defaultText,
    );

    expect(text).not.toContain("ada@example.com");
    expect(text).not.toContain("Your details\nEmail");
  });

  it("shows the signer where the friend's note went", () => {
    const { text } = mailTemplates.signupConfirmation(
      {
        status: "confirmed",
        event: {
          title: "Winter table",
          date: event.date,
          url: event.url,
          mailSubject: null,
          mailMessage: null,
        },
        booking: {
          guests: [
            {
              name: "Ada",
              isStudent: false,
              vegetarian: false,
              price: 45,
              email: null,
              rows: [],
            },
            grace,
          ],
          contact: [],
          total: 75,
        },
      },
      defaultText,
    );

    expect(text).toContain(
      "Guest 2: Grace\nVegan / Vegetarian: no\nTheir email: grace@example.com",
    );
  });
});
