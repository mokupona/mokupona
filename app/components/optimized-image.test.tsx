import { fireEvent, render, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { OptimizedImage } from "./optimized-image";

import type { ImageDisplaySource, ImageProviderConfig } from "~/shared/image";

const mocks = vi.hoisted(() => ({
  useImageConfig: vi.fn<() => ImageProviderConfig>(() => ({
    imageProvider: "local",
    cloudinaryCloudName: null,
  })),
}));

vi.mock("~/shared/root-data", () => ({
  useImageConfig: mocks.useImageConfig,
}));

const image: ImageDisplaySource = {
  id: "img-1",
  storageKey: "abc123",
  version: 3,
  width: 1200,
  height: 800,
  blurDataUrl: "data:image/webp;base64,dGlueQ==",
};

function renderImage(overrides: Partial<ImageDisplaySource> = {}) {
  return render(
    <OptimizedImage
      image={{ ...image, ...overrides }}
      width={640}
      height={480}
      alt="An event table"
    />,
  );
}

function stubImageComplete(value: boolean) {
  const original = Object.getOwnPropertyDescriptor(
    HTMLImageElement.prototype,
    "complete",
  );
  Object.defineProperty(HTMLImageElement.prototype, "complete", {
    configurable: true,
    get: () => value,
  });
  return () => {
    if (original) {
      Object.defineProperty(HTMLImageElement.prototype, "complete", original);
    }
  };
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("OptimizedImage blur-up", () => {
  it("layers the stored placeholder under the real image", () => {
    const restore = stubImageComplete(false);
    const { container } = renderImage();

    const placeholder = container.querySelector(
      `img[src="${image.blurDataUrl}"]`,
    );
    expect(placeholder).toBeInTheDocument();
    expect(placeholder).toHaveAttribute("aria-hidden");
    expect(container.querySelector(".backdrop-blur-2xl")).toBeInTheDocument();

    restore();
  });

  it("falls back to a neutral surface when no placeholder is stored", () => {
    const restore = stubImageComplete(false);
    const { container } = renderImage({ blurDataUrl: null });

    expect(
      container.querySelector("img[src^='data:']"),
    ).not.toBeInTheDocument();
    expect(
      container.querySelector(".backdrop-blur-2xl"),
    ).not.toBeInTheDocument();
    expect(container.querySelector(".bg-primary\\/10")).toBeInTheDocument();

    restore();
  });

  it("reserves the requested crop's aspect ratio on the frame", () => {
    const restore = stubImageComplete(false);
    const { container } = renderImage();

    expect(container.firstElementChild).toHaveStyle({
      aspectRatio: "640 / 480",
    });

    restore();
  });

  it("lets a caller override the reserved ratio via style", () => {
    const restore = stubImageComplete(false);
    const { container } = render(
      <OptimizedImage
        image={image}
        width={640}
        height={480}
        style={{ aspectRatio: "1200 / 800" }}
        alt="An event table"
      />,
    );

    expect(container.firstElementChild).toHaveStyle({
      aspectRatio: "1200 / 800",
    });

    restore();
  });

  it("fades the real image in on load", () => {
    const restore = stubImageComplete(false);
    renderImage();

    const img = screen.getByAltText("An event table");
    expect(img).toHaveClass("opacity-0");

    fireEvent.load(img);

    expect(img).toHaveClass("opacity-100");
    restore();
  });

  it("shows a cached (already complete) image immediately — no load event fires", () => {
    const restore = stubImageComplete(true);
    renderImage();

    expect(screen.getByAltText("An event table")).toHaveClass("opacity-100");
    restore();
  });

  it("provides a full-opacity noscript fallback so no-JS visitors never sit on the blur", () => {
    const html = renderToString(
      <OptimizedImage image={image} width={640} height={480} alt="A table" />,
    );

    const [, noscriptMarkup] = html.split("<noscript>");
    expect(noscriptMarkup).toBeDefined();
    const fallback = noscriptMarkup.split("</noscript>")[0];
    expect(fallback).toContain('src="/file/img-1"');
    expect(fallback).not.toContain("opacity-0");
  });

  it("renders the placeholder frame alone when no URL can be built (offline static asset)", () => {
    const restore = stubImageComplete(false);
    const { container } = render(
      <OptimizedImage
        image={{ storageKey: "static/hero-image" }}
        width={640}
        height={480}
        alt="Hero"
      />,
    );

    expect(container.querySelector("img")).not.toBeInTheDocument();
    expect(container.querySelector(".bg-primary\\/10")).toBeInTheDocument();
    restore();
  });

  it("loads eagerly unless the caller asks for lazy", () => {
    const restore = stubImageComplete(false);
    const { rerender } = renderImage();

    expect(screen.getByAltText("An event table")).toHaveAttribute(
      "loading",
      "eager",
    );

    rerender(
      <OptimizedImage
        image={image}
        width={640}
        height={480}
        alt="An event table"
        loading="lazy"
      />,
    );

    expect(screen.getByAltText("An event table")).toHaveAttribute(
      "loading",
      "lazy",
    );
    restore();
  });

  it("emits provider URLs for src and every srcSet rung", () => {
    mocks.useImageConfig.mockReturnValue({
      imageProvider: "cloudinary",
      cloudinaryCloudName: "test-cloud",
    });
    const restore = stubImageComplete(false);
    renderImage();

    const img = screen.getByAltText("An event table");
    expect(img).toHaveAttribute(
      "src",
      "https://res.cloudinary.com/test-cloud/image/upload/f_auto,q_auto,c_fill,g_auto,w_640,h_480/v3/abc123",
    );
    expect(img.getAttribute("srcset")).toContain("w_432,h_324/v3/abc123 432w");
    expect(img.getAttribute("srcset")).toContain(
      "w_1080,h_810/v3/abc123 1080w",
    );
    restore();
  });
});

describe("OptimizedImage framing", () => {
  const framing = {
    cropX: 0.25,
    cropY: 0.25,
    cropWidth: 0.5,
    cropHeight: 0.5,
  };

  function mainImage(container: HTMLElement) {
    return container.querySelector<HTMLImageElement>('img[alt="Cropped"]')!;
  }

  it("places the whole local file so the frame shows the crop", () => {
    mocks.useImageConfig.mockReturnValue({
      imageProvider: "local",
      cloudinaryCloudName: null,
    });
    const { container } = render(
      <OptimizedImage
        image={{ ...image, ...framing }}
        width={600}
        height={400}
        alt="Cropped"
      />,
    );

    const img = mainImage(container);
    expect(img).not.toHaveClass("object-cover");
    expect(img.style.width).toBe("200.0000%");
    expect(img.style.left).toBe("-50.0000%");
    expect(img.style.top).toBe("-50.0000%");
  });

  it("lets Cloudinary do the cropping when it delivers", () => {
    mocks.useImageConfig.mockReturnValue({
      imageProvider: "cloudinary",
      cloudinaryCloudName: "test-cloud",
    });
    const { container } = render(
      <OptimizedImage
        image={{ ...image, ...framing }}
        width={600}
        height={400}
        alt="Cropped"
      />,
    );

    const img = mainImage(container);
    expect(img).toHaveClass("object-cover");
    expect(img.getAttribute("src")).toContain("c_crop,x_300,y_200,w_600,h_400");
    expect(img.style.width).toBe("");
  });
});
