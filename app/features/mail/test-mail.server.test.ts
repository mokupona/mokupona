import { existsSync } from "node:fs";
import { mkdtemp, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it, vi } from "vitest";

import { latestMailPath, mailCaptureFolder } from "./capture.shared";

describe("sendTestMail", () => {
  it("sends the admin alone the mail, marked as a test", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "mail-capture-"));
    vi.stubEnv("MAIL_PROVIDER", "capture");
    vi.stubEnv("MAIL_CAPTURE_DIR", dir);
    vi.stubEnv("GUEST_MAIL_COPY_TO", "team@example.com");
    // the provider is picked on first use, from the environment above
    const { sendTestMail } = await import("./mail.server");

    await sendTestMail(
      "admin@example.com",
      { subject: "The menu", text: "Soup", html: "<p>Soup</p>" },
      {
        from: "moku pona <noreply@mokupona.ch>",
        replyTo: "contact@mokupona.ch",
      },
    );

    const sent = JSON.parse(
      await readFile(latestMailPath("admin@example.com", dir), "utf8"),
    );
    expect(sent).toMatchObject({
      to: "admin@example.com",
      from: "moku pona <noreply@mokupona.ch>",
      replyTo: "contact@mokupona.ch",
      subject: "[Test] The menu",
      text: "Soup",
    });
    // the team gets no copy of a test
    expect(existsSync(mailCaptureFolder("team@example.com", dir))).toBe(false);

    vi.unstubAllEnvs();
  });
});
