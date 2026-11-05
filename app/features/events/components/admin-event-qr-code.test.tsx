import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { toast } from "sonner";
import { afterEach, describe, expect, it, vi } from "vitest";

import type * as QrCodeModule from "../qr-code";
import { createQrCode, qrCodePng, qrCodeSvgDataUrl } from "../qr-code";

import { AdminEventQrCode } from "./admin-event-qr-code";

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

// happy-dom has no canvas, so the PNG itself is stubbed
vi.mock("../qr-code", async (importOriginal) => ({
  ...(await importOriginal<typeof QrCodeModule>()),
  qrCodePng: vi.fn(),
}));

const png = new Blob(["png"], { type: "image/png" });

const url = "https://mokupona.ch/events/cm9x2k3ab0001qz8f7h6y5t4r";

function renderPanel() {
  return render(<AdminEventQrCode url={url} title="Summer Dinner" />);
}

function stubClipboard(clipboard: Partial<Clipboard>) {
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: clipboard,
  });
}

afterEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("AdminEventQrCode", () => {
  it("shows the QR code of the public event page and links to it", () => {
    renderPanel();

    expect(
      screen.getByRole("heading", { name: "QR code" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: `QR code linking to ${url}` }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: url })).toHaveAttribute(
      "href",
      url,
    );
  });

  it("offers the SVG as a named download of the same code", () => {
    renderPanel();

    const link = screen.getByRole("link", { name: /download svg/i });
    expect(link).toHaveAttribute("download", "summer-dinner-qr-code.svg");
    expect(link).toHaveAttribute("href", qrCodeSvgDataUrl(createQrCode(url)));
  });

  it("copies the event link", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    stubClipboard({ writeText });
    renderPanel();

    fireEvent.click(screen.getByRole("button", { name: /copy link/i }));

    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith("Link copied"),
    );
    expect(writeText).toHaveBeenCalledWith(url);
  });

  it("says so when the link can't be copied", async () => {
    stubClipboard({
      writeText: vi.fn().mockRejectedValue(new Error("denied")),
    });
    renderPanel();

    fireEvent.click(screen.getByRole("button", { name: /copy link/i }));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Couldn't copy the link."),
    );
  });

  it("copies the code as a PNG image", async () => {
    vi.mocked(qrCodePng).mockResolvedValue(png);
    const write = vi.fn().mockResolvedValue(undefined);
    stubClipboard({ write });
    vi.stubGlobal(
      "ClipboardItem",
      class {
        constructor(public items: Record<string, Promise<Blob>>) {}
      },
    );
    renderPanel();

    fireEvent.click(screen.getByRole("button", { name: /copy image/i }));

    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith("QR code copied"),
    );
    const [[[item]]] = write.mock.calls;
    expect(Object.keys(item.items)).toEqual(["image/png"]);
    await expect(item.items["image/png"]).resolves.toBe(png);
    expect(qrCodePng).toHaveBeenCalledWith(createQrCode(url));
  });

  it("downloads the code as a named PNG", async () => {
    vi.mocked(qrCodePng).mockResolvedValue(png);
    const createObjectURL = vi
      .spyOn(URL, "createObjectURL")
      .mockReturnValue("blob:qr");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(function (this: HTMLAnchorElement) {
        expect(this).toHaveAttribute("href", "blob:qr");
        expect(this).toHaveAttribute("download", "summer-dinner-qr-code.png");
      });
    renderPanel();

    fireEvent.click(screen.getByRole("button", { name: /download png/i }));

    await waitFor(() => expect(click).toHaveBeenCalledOnce());
    expect(createObjectURL).toHaveBeenCalledWith(png);
  });

  it("says so when the PNG can't be made", async () => {
    vi.mocked(qrCodePng).mockRejectedValue(new Error("no canvas"));
    renderPanel();

    fireEvent.click(screen.getByRole("button", { name: /download png/i }));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        "Couldn't create the PNG. Try the SVG instead.",
      ),
    );
  });

  it("points to the PNG download where images can't be copied", async () => {
    stubClipboard({ writeText: vi.fn() });
    vi.stubGlobal("ClipboardItem", undefined);
    renderPanel();

    fireEvent.click(screen.getByRole("button", { name: /copy image/i }));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        "This browser can't copy images. Download the PNG instead.",
      ),
    );
  });
});
