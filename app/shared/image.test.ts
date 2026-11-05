import { describe, expect, it } from "vitest";

import {
  deliversFramedImage,
  getImageUrl,
  IMAGE_SIZE_ERROR,
  IMAGE_TYPE_ERROR,
  imageFileSchema,
  type ImageProviderConfig,
} from "./image";

const localConfig: ImageProviderConfig = {
  imageProvider: "local",
  cloudinaryCloudName: null,
};

const cloudinaryConfig: ImageProviderConfig = {
  imageProvider: "cloudinary",
  cloudinaryCloudName: "test-cloud",
};

const dbImage = {
  id: "img-1",
  storageKey: "abc123",
  version: 42,
};

describe("getImageUrl — local provider", () => {
  it("serves DB images from the resource route, dropping transforms", () => {
    expect(getImageUrl(dbImage, localConfig)).toBe("/file/img-1");
    expect(getImageUrl(dbImage, localConfig, { width: 432, height: 324 })).toBe(
      "/file/img-1",
    );
  });

  it("serves a locally stored row (no cloud name) from the resource route", () => {
    expect(
      getImageUrl({ id: "img-1", storageKey: "events/uuid" }, localConfig),
    ).toBe("/file/img-1");
  });
});

describe("getImageUrl — cloudinary provider", () => {
  it("builds a versioned delivery URL with f_auto,q_auto and no crop by default", () => {
    expect(getImageUrl(dbImage, cloudinaryConfig)).toBe(
      "https://res.cloudinary.com/test-cloud/image/upload/f_auto,q_auto/v42/abc123",
    );
  });

  it.each([
    [{ width: 432, height: 324 }, "f_auto,q_auto,c_fill,g_auto,w_432,h_324"],
    [
      { width: 432, height: 324, fit: "cover" as const },
      "f_auto,q_auto,c_fill,g_auto,w_432,h_324",
    ],
    [
      { width: 432, height: 324, fit: "contain" as const },
      "f_auto,q_auto,c_fit,w_432,h_324",
    ],
    [
      { width: 432, height: 324, fit: "fill" as const },
      "f_auto,q_auto,c_scale,w_432,h_324",
    ],
    [{ width: 648 }, "f_auto,q_auto,c_fill,g_auto,w_648"],
    [{ height: 480 }, "f_auto,q_auto,c_fill,g_auto,h_480"],
  ])("maps transform options %o", (options, transform) => {
    expect(getImageUrl(dbImage, cloudinaryConfig, options)).toBe(
      `https://res.cloudinary.com/test-cloud/image/upload/${transform}/v42/abc123`,
    );
  });

  it("omits the version segment when the row has none", () => {
    expect(
      getImageUrl({ id: "img-1", storageKey: "abc123" }, cloudinaryConfig),
    ).toBe(
      "https://res.cloudinary.com/test-cloud/image/upload/f_auto,q_auto/abc123",
    );
  });

  it("falls back to the resource route without a configured cloud name", () => {
    expect(
      getImageUrl(
        { id: "img-1", storageKey: "abc123" },
        { imageProvider: "cloudinary", cloudinaryCloudName: null },
      ),
    ).toBe("/file/img-1");
  });
});

describe("getImageUrl — static public_id-only assets", () => {
  it("uses cloudinary regardless of the provider when a cloud name exists", () => {
    expect(
      getImageUrl(
        { storageKey: "static/hero-image" },
        { imageProvider: "local", cloudinaryCloudName: "test-cloud" },
        { width: 864 },
      ),
    ).toBe(
      "https://res.cloudinary.com/test-cloud/image/upload/f_auto,q_auto,c_fill,g_auto,w_864/static/hero-image",
    );
  });

  it("renders nothing without a cloud name (offline dev hero)", () => {
    expect(getImageUrl({ storageKey: "static/hero-image" }, localConfig)).toBe(
      "",
    );
  });
});

describe("imageFileSchema", () => {
  const schema = imageFileSchema();

  function upload(bytes: number, type = "image/jpeg") {
    return new File([new Uint8Array(bytes)], "upload.jpg", { type });
  }

  function firstError(file: File) {
    const result = schema.safeParse(file);
    return result.success ? null : result.error.issues[0]?.message;
  }

  it.each(["image/jpeg", "image/png", "image/webp"])(
    "accepts a small %s upload",
    (type) => {
      expect(schema.safeParse(upload(10, type)).success).toBe(true);
    },
  );

  it("rejects an empty file", () => {
    expect(firstError(upload(0))).toBe("You must select a file");
  });

  it("rejects a file over the 3MB cap", () => {
    expect(firstError(upload(3 * 1024 * 1024 + 1))).toBe(IMAGE_SIZE_ERROR);
  });

  it.each(["image/gif", "image/svg+xml", "application/pdf", ""])(
    "rejects the %s MIME type server-side",
    (type) => {
      expect(firstError(upload(10, type))).toBe(IMAGE_TYPE_ERROR);
    },
  );
});

describe("getImageUrl — an admin's framing", () => {
  const framed = {
    ...dbImage,
    width: 1200,
    height: 800,
    cropX: 0.1,
    cropY: 0.2,
    cropWidth: 0.5,
    cropHeight: 0.4,
  };
  const base = "https://res.cloudinary.com/test-cloud/image/upload";

  it("crops on Cloudinary first, then sizes the crop around its middle", () => {
    expect(
      getImageUrl(framed, cloudinaryConfig, { width: 432, height: 288 }),
    ).toBe(
      `${base}/c_crop,x_120,y_160,w_600,h_320/f_auto,q_auto,c_fill,g_center,w_432,h_288/v42/abc123`,
    );
    expect(getImageUrl(framed, cloudinaryConfig)).toBe(
      `${base}/c_crop,x_120,y_160,w_600,h_320/f_auto,q_auto/v42/abc123`,
    );
    expect(
      getImageUrl(framed, cloudinaryConfig, { width: 1280, fit: "contain" }),
    ).toBe(
      `${base}/c_crop,x_120,y_160,w_600,h_320/f_auto,q_auto,c_fit,w_1280/v42/abc123`,
    );
  });

  it("hands out the whole photo when asked, to edit the framing", () => {
    expect(getImageUrl(framed, cloudinaryConfig, { uncropped: true })).toBe(
      `${base}/f_auto,q_auto/v42/abc123`,
    );
  });

  it("can't cut a crop without the stored size", () => {
    expect(
      getImageUrl({ ...framed, width: null }, cloudinaryConfig, {
        width: 432,
        height: 288,
      }),
    ).toBe(`${base}/f_auto,q_auto,c_fill,g_auto,w_432,h_288/v42/abc123`);
  });

  it("leaves the local provider's file as it is", () => {
    expect(getImageUrl(framed, localConfig, { width: 432 })).toBe(
      "/file/img-1",
    );
  });

  it("says which deliveries arrive already framed", () => {
    expect(deliversFramedImage(framed, cloudinaryConfig)).toBe(true);
    expect(deliversFramedImage(framed, localConfig)).toBe(false);
    expect(deliversFramedImage(dbImage, cloudinaryConfig)).toBe(false);
  });
});
