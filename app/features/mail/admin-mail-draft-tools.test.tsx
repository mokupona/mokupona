import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MailDraftTools } from "./admin-mail-draft-tools";

const fetchMock = vi.fn();

function lastBody(intent: string): FormData {
  const calls = fetchMock.mock.calls.filter(
    ([, init]) => (init.body as FormData).get("intent") === intent,
  );
  return calls[calls.length - 1][1].body as FormData;
}

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockImplementation(async (_path: string, init: RequestInit) => {
    const body = init.body as FormData;
    if (body.get("intent") === "test") {
      return Response.json({
        ok: true,
        intent: "test",
        sentTo: "admin@example.com",
      });
    }
    return Response.json({
      ok: true,
      intent: "preview",
      subject: `Re: ${body.get("subject")}`,
      html: `<!doctype html><html><body><p>${body.get("message")}</p></body></html>`,
      recipient: { name: "Ada", email: "ada@example.com" },
      recipientCount: 3,
    });
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  fetchMock.mockReset();
});

function Editor({ defaultOpen }: { defaultOpen?: boolean }) {
  return (
    <form>
      <input name="audience" type="checkbox" value="confirmed" defaultChecked />
      <input aria-label="Subject" name="subject" defaultValue="The menu" />
      <textarea aria-label="Message" name="message" defaultValue="Soup" />
      <MailDraftTools kind="everyone" eventId="e1" defaultOpen={defaultOpen} />
    </form>
  );
}

describe("MailDraftTools", () => {
  it("previews the mail as the form has it, for its first recipient", async () => {
    render(<Editor />);

    const frame = await screen.findByTitle("Email preview");
    expect(frame.getAttribute("srcdoc")).toContain("<p>Soup</p>");
    expect(await screen.findByText("Re: The menu")).toBeTruthy();
    expect(
      screen.getByText("As Ada (ada@example.com) will get it, the first of 3."),
    ).toBeTruthy();

    const body = lastBody("preview");
    expect(body.get("kind")).toBe("everyone");
    expect(body.get("eventId")).toBe("e1");
    expect(body.getAll("audience")).toEqual(["confirmed"]);
  });

  it("follows what's typed", async () => {
    render(<Editor />);
    await screen.findByTitle("Email preview");

    const message = screen.getByLabelText<HTMLTextAreaElement>("Message");
    fireEvent.input(message, { target: { value: "Risotto" } });

    await waitFor(() =>
      expect(
        screen.getByTitle("Email preview").getAttribute("srcdoc"),
      ).toContain("<p>Risotto</p>"),
    );
  });

  it("stays closed until asked when it starts closed", async () => {
    render(<Editor defaultOpen={false} />);

    expect(screen.queryByTitle("Email preview")).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Preview" }));
    expect(await screen.findByTitle("Email preview")).toBeTruthy();
  });

  it("sends a test to the admin and says where it went", async () => {
    render(<Editor defaultOpen={false} />);

    fireEvent.click(screen.getByRole("button", { name: "Send a test to me" }));

    expect(
      await screen.findByText(
        "Test sent to admin@example.com, marked [Test]. Nobody else got it.",
      ),
    ).toBeTruthy();
    expect(lastBody("test").get("message")).toBe("Soup");
  });

  it("waits for a picture still uploading before a test", async () => {
    render(<Editor defaultOpen={false} />);
    screen
      .getByLabelText<HTMLTextAreaElement>("Message")
      .setCustomValidity("Wait for the image to finish uploading.");

    fireEvent.click(screen.getByRole("button", { name: "Send a test to me" }));

    expect(
      await screen.findByText("Wait for the image to finish uploading."),
    ).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("shows why a test couldn't go out", async () => {
    fetchMock.mockResolvedValueOnce(
      Response.json({ ok: false, error: "The email needs a subject." }),
    );
    render(<Editor defaultOpen={false} />);

    fireEvent.click(screen.getByRole("button", { name: "Send a test to me" }));

    expect(await screen.findByText("The email needs a subject.")).toBeTruthy();
  });
});
