import { describe, expect, it } from "vitest";

import {
  localMailImageKey,
  mailImageConfigFromEnv,
  mailImageUrl,
} from "./mail-images.server";

const uuid = "0b7c6a4e-3f1d-4c2b-9a8e-5d6f7a8b9c0d";

describe("mailImageUrl", () => {
  it("points at Cloudinary's original file, in its own format", () => {
    expect(
      mailImageUrl(
        { storageKey: "abc123", version: 1700000000 },
        { imageProvider: "cloudinary", cloudinaryCloudName: "demo" },
        "https://mokupona.ch",
      ),
    ).toBe(
      "https://res.cloudinary.com/demo/image/upload/q_auto/v1700000000/abc123",
    );
  });

  it("points at this site's own route under the local provider", () => {
    expect(
      mailImageUrl(
        { storageKey: `mail/${uuid}` },
        { imageProvider: "local", cloudinaryCloudName: null },
        "http://localhost:3000",
      ),
    ).toBe(`http://localhost:3000/mail-images/${uuid}`);
  });
});

describe("localMailImageKey", () => {
  it("maps a picture's name back to its key in the mail folder", () => {
    expect(localMailImageKey(uuid)).toBe(`mail/${uuid}`);
  });

  it("refuses anything that isn't one of its names", () => {
    expect(localMailImageKey(undefined)).toBeNull();
    expect(localMailImageKey("../events/x")).toBeNull();
    expect(localMailImageKey(`${uuid}/../x`)).toBeNull();
  });
});

describe("mailImageConfigFromEnv", () => {
  it("reads the provider and cloud from the environment", () => {
    expect(
      mailImageConfigFromEnv({
        IMAGE_PROVIDER: "cloudinary",
        CLOUDINARY_CLOUD_NAME: "demo",
      }),
    ).toEqual({ imageProvider: "cloudinary", cloudinaryCloudName: "demo" });
    expect(mailImageConfigFromEnv({})).toEqual({
      imageProvider: "local",
      cloudinaryCloudName: null,
    });
  });
});
