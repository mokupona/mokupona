// @vitest-environment node
import { LazyFile } from "@remix-run/lazy-file";
import { RouterContextProvider } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

import { action } from "~/routes/admin.mail-images";
import { loader } from "~/routes/mail-images.$name";

const mocks = vi.hoisted(() => ({
  storeImage: vi.fn(),
  getLocalImageFile: vi.fn(),
}));

vi.mock("~/features/images/image-storage.server", () => ({
  storeImage: mocks.storeImage,
}));

vi.mock("~/features/images/providers/local.server", () => ({
  getLocalImageFile: mocks.getLocalImageFile,
}));

const uuid = "0b7c6a4e-3f1d-4c2b-9a8e-5d6f7a8b9c0d";

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
});

// the admin layout's middleware has let a moderator through by now
async function upload(file?: File) {
  const body = new FormData();
  if (file) body.append("image", file);
  const response = await action({
    params: {},
    request: new Request("http://localhost:3000/admin/mail-images", {
      method: "POST",
      body,
    }),
    context: new RouterContextProvider(),
  } as unknown as Parameters<typeof action>[0]);
  return { status: response.status, body: await response.json() };
}

function png(bytes = 16) {
  return new File([new Uint8Array(bytes)], "image.png", { type: "image/png" });
}

describe("POST /admin/mail-images", () => {
  it("stores the picture in the mail folder and replies with its address", async () => {
    vi.stubEnv("IMAGE_PROVIDER", "cloudinary");
    vi.stubEnv("CLOUDINARY_CLOUD_NAME", "demo");
    mocks.storeImage.mockResolvedValue({ storageKey: "abc123", version: 7 });

    expect(await upload(png())).toEqual({
      status: 200,
      body: {
        ok: true,
        url: "https://res.cloudinary.com/demo/image/upload/q_auto/v7/abc123",
      },
    });
    expect(mocks.storeImage).toHaveBeenCalledWith(
      expect.objectContaining({ type: "image/png" }),
      "mail",
    );
  });

  it("links to this site's own route under the local provider", async () => {
    vi.stubEnv("IMAGE_PROVIDER", "local");
    mocks.storeImage.mockResolvedValue({ storageKey: `mail/${uuid}` });

    expect((await upload(png())).body).toEqual({
      ok: true,
      url: `http://localhost:3000/mail-images/${uuid}`,
    });
  });

  it("refuses something that isn't an image", async () => {
    const { status, body } = await upload(
      new File(["hi"], "notes.txt", { type: "text/plain" }),
    );

    expect(status).toBe(400);
    expect(body).toEqual({
      ok: false,
      error: "File must be a JPEG, PNG or WebP image",
    });
    expect(mocks.storeImage).not.toHaveBeenCalled();
  });

  it("refuses a request without a file", async () => {
    const { status, body } = await upload();

    expect(status).toBe(400);
    expect(body.ok).toBe(false);
  });

  it("says so when the provider fails", async () => {
    mocks.storeImage.mockRejectedValue(new Error("Cloudinary is down"));

    const { status, body } = await upload(png());

    expect(status).toBe(502);
    expect(body).toEqual({
      ok: false,
      error: "The image couldn't be uploaded. Try again in a moment.",
    });
  });
});

function load(name: string) {
  return loader({
    params: { name },
    request: new Request(`http://localhost:3000/mail-images/${name}`),
  } as unknown as Parameters<typeof loader>[0]);
}

describe("GET /mail-images/:name", () => {
  it("serves a locally stored picture with its type", async () => {
    mocks.getLocalImageFile.mockResolvedValue(
      new LazyFile(["png bytes"], uuid, { type: "image/png" }),
    );

    const response = await load(uuid);

    expect(mocks.getLocalImageFile).toHaveBeenCalledWith(`mail/${uuid}`);
    expect(response.headers.get("Content-Type")).toBe("image/png");
    expect(await response.text()).toBe("png bytes");
  });

  it("404s for a picture that isn't there", async () => {
    mocks.getLocalImageFile.mockResolvedValue(null);

    await expect(load(uuid)).rejects.toMatchObject({ status: 404 });
  });

  it("404s without reading anything for a name that isn't one", async () => {
    await expect(load("..%2Fevents%2Fx")).rejects.toMatchObject({
      status: 404,
    });
    expect(mocks.getLocalImageFile).not.toHaveBeenCalled();
  });
});
