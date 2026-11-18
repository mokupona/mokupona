// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createResendProvider } from "./resend.server";

const { send } = vi.hoisted(() => ({ send: vi.fn() }));

vi.mock("resend", () => ({
  Resend: class {
    emails = { send };
  },
}));

const RATE_LIMITED = {
  data: null,
  error: {
    name: "rate_limit_exceeded",
    message: "Too many requests",
    statusCode: 429,
  },
};
const SENT = { data: { id: "mail_1" }, error: null };

function provider() {
  return createResendProvider({ RESEND_API_KEY: "re_x" }, { retryDelayMs: 1 });
}

beforeEach(() => {
  send.mockReset();
});

describe("resend provider", () => {
  it("waits and tries again when Resend is rate limiting", async () => {
    send.mockResolvedValueOnce(RATE_LIMITED).mockResolvedValueOnce(SENT);

    await provider().send({ to: "a@example.com", subject: "Hi", text: "Hi" });

    expect(send).toHaveBeenCalledTimes(2);
  });

  it("gives up after a few tries", async () => {
    send.mockResolvedValue(RATE_LIMITED);

    await expect(
      provider().send({ to: "a@example.com", subject: "Hi", text: "Hi" }),
    ).rejects.toThrow(/Too many requests/);
    expect(send).toHaveBeenCalledTimes(4);
  });

  it("doesn't retry a mail Resend refuses for good", async () => {
    send.mockResolvedValue({
      data: null,
      error: {
        name: "validation_error",
        message: "Invalid `to` field",
        statusCode: 422,
      },
    });

    await expect(
      provider().send({ to: "nope", subject: "Hi", text: "Hi" }),
    ).rejects.toThrow(/Invalid `to` field/);
    expect(send).toHaveBeenCalledTimes(1);
  });
});
