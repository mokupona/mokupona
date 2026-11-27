import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  asOwnParagraph,
  pastedImages,
  uploadPlaceholder,
  useMailImagePaste,
} from "./admin-image-paste";

function png(name = "image.png") {
  return new File([new Uint8Array(32)], name, { type: "image/png" });
}

function clipboard(files: File[], text = "") {
  return {
    files,
    types: [...(files.length > 0 ? ["Files"] : []), "text/plain"],
    getData: (format: string) => (format === "text/plain" ? text : ""),
  };
}

describe("pastedImages", () => {
  it("takes a pasted screenshot", () => {
    const image = png();
    expect(pastedImages(clipboard([image]))).toEqual([image]);
  });

  it("takes a copied file or image along with its name or address", () => {
    const image = png("menu.png");
    expect(pastedImages(clipboard([image], "menu.png"))).toEqual([image]);
    expect(
      pastedImages(clipboard([image], "https://example.com/menu.png")),
    ).toEqual([image]);
  });

  it("leaves text copied with a picture of itself (Word) to paste as words", () => {
    expect(pastedImages(clipboard([png()], "Dear all,\nsee you"))).toEqual([]);
  });

  it("leaves out files that aren't images", () => {
    const pdf = new File(["%PDF"], "menu.pdf", { type: "application/pdf" });
    expect(pastedImages(clipboard([pdf]))).toEqual([]);
    expect(pastedImages(null)).toEqual([]);
  });
});

describe("asOwnParagraph", () => {
  it("sets the insert apart from the text around it", () => {
    expect(asOwnParagraph("Hi", "X", "Bye")).toBe("\n\nX\n\n");
    expect(asOwnParagraph("Hi\n", "X", "\nBye")).toBe("\nX\n");
    expect(asOwnParagraph("Hi\n\n", "X", "\n\nBye")).toBe("X");
    expect(asOwnParagraph("", "X", "")).toBe("X\n\n");
  });
});

describe("uploadPlaceholder", () => {
  it("names the file, and tells a second one of the same name apart", () => {
    expect(uploadPlaceholder("", "image.png")).toBe(
      "![Uploading image.png…]()",
    );
    expect(uploadPlaceholder("![Uploading image.png…]()", "image.png")).toBe(
      "![Uploading image.png (2)…]()",
    );
    expect(uploadPlaceholder("", "[odd].png")).toBe("![Uploading odd.png…]()");
  });
});

function Editor() {
  const { handlers, status } = useMailImagePaste();
  return (
    <form>
      <textarea aria-label="Message" defaultValue="Hello" {...handlers} />
      {status}
    </form>
  );
}

function reply(body: unknown) {
  return Promise.resolve(Response.json(body));
}

describe("useMailImagePaste", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal(
      "createImageBitmap",
      vi.fn(async () => ({ width: 300, height: 200, close() {} })),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });

  function editor() {
    render(<Editor />);
    const textarea = screen.getByLabelText<HTMLTextAreaElement>("Message");
    textarea.setSelectionRange(5, 5);
    return textarea;
  }

  it("uploads a pasted image and puts it into the message where the cursor was", async () => {
    const url = "https://res.cloudinary.com/demo/image/upload/q_auto/v1/a";
    let answer: (response: Response) => void = () => {};
    fetchMock.mockReturnValue(
      new Promise<Response>((resolve) => (answer = resolve)),
    );
    const textarea = editor();
    const changes = vi.fn();
    textarea.addEventListener("input", changes);

    fireEvent.paste(textarea, { clipboardData: clipboard([png()]) });

    expect(textarea.value).toBe("Hello\n\n![Uploading image.png…]()\n\n");
    expect(textarea.validationMessage).toBe(
      "Wait for the image to finish uploading.",
    );
    await waitFor(() =>
      expect(screen.getByRole("status").textContent).toBe(
        "Uploading the image…",
      ),
    );

    answer(Response.json({ ok: true, url }));

    await waitFor(() =>
      expect(textarea.value).toBe(`Hello\n\n![](${url})\n\n`),
    );
    expect(textarea.validationMessage).toBe("");
    expect(changes).toHaveBeenCalledTimes(2);
    await waitFor(() =>
      expect(screen.getByRole("status").textContent).toBe(""),
    );

    const [path, init] = fetchMock.mock.calls[0];
    expect(path).toBe("/admin/mail-images");
    expect((init.body as FormData).get("image")).toBeInstanceOf(File);
  });

  it("takes the placeholder out and says why when the upload fails", async () => {
    fetchMock.mockReturnValue(
      reply({ ok: false, error: "File cannot be greater than 3MB" }),
    );
    const textarea = editor();

    fireEvent.paste(textarea, { clipboardData: clipboard([png()]) });

    await waitFor(() =>
      expect(screen.getByRole("status").textContent).toBe(
        "File cannot be greater than 3MB",
      ),
    );
    expect(textarea.value).not.toContain("Uploading");
    expect(textarea.validationMessage).toBe("");
  });

  it("lets text paste as usual", () => {
    const textarea = editor();

    const event = fireEvent.paste(textarea, {
      clipboardData: clipboard([], "just words"),
    });

    // not cancelled: the browser pastes the words
    expect(event).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("keeps a dropped file that isn't an image from opening in the tab", () => {
    const textarea = editor();
    const pdf = new File(["%PDF"], "menu.pdf", { type: "application/pdf" });

    const event = fireEvent.drop(textarea, {
      dataTransfer: { files: [pdf], types: ["Files"] },
    });

    expect(event).toBe(false);
    expect(screen.getByRole("status").textContent).toBe(
      "Only images can go into an email.",
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("uploads a dropped image", async () => {
    const url = "https://res.cloudinary.com/demo/image/upload/q_auto/v1/b";
    fetchMock.mockReturnValue(reply({ ok: true, url }));
    const textarea = editor();

    fireEvent.drop(textarea, {
      dataTransfer: { files: [png("photo.png")], types: ["Files"] },
    });

    await waitFor(() =>
      expect(textarea.value).toBe(`Hello\n\n![](${url})\n\n`),
    );
  });
});
