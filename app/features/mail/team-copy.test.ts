// @vitest-environment node
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type MockInstance,
} from "vitest";

import {
  DEFAULT_GUEST_MAIL_COPY_TO,
  guestMailCopyTo,
  sendTemplate,
} from "./mail.server";

// the tests run on the console provider, which prints each mail it "sends"
let printed: MockInstance<typeof console.info>;

beforeEach(() => {
  printed = vi.spyOn(console, "info").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

function sentMails() {
  return printed.mock.calls.map(([output]) => {
    const lines = String(output).split("\n");
    const header = (name: string) =>
      lines
        .find((line) => line.startsWith(`${name}:`))
        ?.slice(name.length + 1)
        .trim();
    return { to: header("To"), subject: header("Subject"), output };
  });
}

const message = {
  subject: "Change of venue",
  message: "We moved next door.",
  event: { title: "Winter table", url: "https://mokupona.ch/events/1" },
};

describe("the team's copy of guest mail", () => {
  it("follows each guest mail, saying who got it", async () => {
    vi.stubEnv("GUEST_MAIL_COPY_TO", "team@example.com");

    await sendTemplate("signupMessage", "ada@example.com", message);

    const [guest, copy] = sentMails();
    expect(guest).toMatchObject({
      to: "ada@example.com",
      subject: "Change of venue",
    });
    expect(copy).toMatchObject({
      to: "team@example.com",
      subject: "Sent to ada@example.com: Change of venue",
    });
    expect(copy.output).toContain(
      "The guest ada@example.com was sent the following email:",
    );
    expect(copy.output).toContain("We moved next door.");
  });

  it("isn't sent for account mail", async () => {
    vi.stubEnv("GUEST_MAIL_COPY_TO", "team@example.com");

    await sendTemplate("verifyEmail", "ada@example.com", {
      url: "https://mokupona.ch/verify?token=t",
    });

    expect(sentMails().map((mail) => mail.to)).toEqual(["ada@example.com"]);
  });

  it("is off when GUEST_MAIL_COPY_TO is set empty", async () => {
    vi.stubEnv("GUEST_MAIL_COPY_TO", "");

    await sendTemplate("signupMessage", "ada@example.com", message);

    expect(sentMails().map((mail) => mail.to)).toEqual(["ada@example.com"]);
  });

  it("doesn't fail the guest's mail when it can't go out", async () => {
    vi.stubEnv("GUEST_MAIL_COPY_TO", "team@example.com");
    printed
      .mockImplementationOnce(() => {})
      .mockImplementationOnce(() => {
        throw new Error("Resend rejected the copy");
      });

    await expect(
      sendTemplate("signupMessage", "ada@example.com", message),
    ).resolves.toBeUndefined();
  });

  it("goes to the dinner club's inbox unless configured otherwise", () => {
    expect(DEFAULT_GUEST_MAIL_COPY_TO).toBe("mokuponadinnerclub@gmail.com");
    expect(guestMailCopyTo({})).toBe("mokuponadinnerclub@gmail.com");
    expect(guestMailCopyTo({ GUEST_MAIL_COPY_TO: " us@example.com " })).toBe(
      "us@example.com",
    );
    expect(guestMailCopyTo({ GUEST_MAIL_COPY_TO: "" })).toBeNull();
  });
});
