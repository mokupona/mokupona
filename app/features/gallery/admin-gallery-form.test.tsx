import { act, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { createRoutesStub } from "react-router";
import { describe, expect, it, vi } from "vitest";

import type { GalleryEntryWithReuse } from "~/models/gallery.server";
import AdminGalleryPage from "~/routes/admin.gallery";
import type { ImageProviderConfig } from "~/shared/image";

// the entry cards render OptimizedImage, which reads delivery config from the
// root loader; pin it so the test never needs the real root route
vi.mock("~/shared/root-data", () => ({
  useImageConfig: (): ImageProviderConfig => ({
    imageProvider: "local",
    cloudinaryCloudName: null,
  }),
}));

function entry(id: string): GalleryEntryWithReuse {
  return {
    id,
    caption: null,
    position: 0,
    altText: null,
    image: {
      id: `img-${id}`,
      storageKey: `event-gallery/${id}`,
      version: 1,
      width: 1200,
      height: 800,
      blurDataUrl: null,
    },
    event: { id: "event-1", title: "nine courses", date: new Date() },
    sharedWith: [],
  };
}

type PageProps = Parameters<typeof AdminGalleryPage>[0];

function propsFor(entries: GalleryEntryWithReuse[]) {
  return {
    loaderData: {
      events: [
        {
          id: "event-1",
          title: "nine courses",
          date: new Date(),
          imageCount: entries.length,
        },
      ],
      event: { id: "event-1", title: "nine courses" },
      entries,
      maxFiles: 12,
    },
    actionData: undefined,
  } as unknown as PageProps;
}

/**
 * Renders the page, then lets a test hand it the gallery a submission left
 * behind — the loader reruns after every upload, so a batch that stored
 * something comes back with more entries than it went in with.
 */
function renderGallery(entries: GalleryEntryWithReuse[]) {
  let settle: (next: GalleryEntryWithReuse[]) => void = () => {};

  function Page() {
    const [current, setCurrent] = useState(entries);
    settle = setCurrent;
    return <AdminGalleryPage {...propsFor(current)} />;
  }

  const Stub = createRoutesStub([{ path: "/", Component: Page }]);
  render(<Stub />);

  return {
    photos: () => screen.getByLabelText(/^photos$/i) as HTMLInputElement,
    caption: () => screen.getByLabelText(/caption/i) as HTMLInputElement,
    settleWith(next: GalleryEntryWithReuse[]) {
      act(() => settle(next));
    },
  };
}

function fill(photos: HTMLInputElement, caption: HTMLInputElement) {
  fireEvent.change(photos, {
    target: { files: [new File(["bytes"], "one.jpg", { type: "image/jpeg" })] },
  });
  fireEvent.change(caption, { target: { value: "A long table" } });
}

describe("admin gallery upload form", () => {
  // happy-dom's form.reset() leaves input.files alone, so the caption stands
  // in for the whole form here; the browser clears both in one call
  it("drops what was submitted once the photos are in the gallery", () => {
    const { photos, caption, settleWith } = renderGallery([]);

    fill(photos(), caption());
    expect(caption().value).toBe("A long table");

    settleWith([entry("one")]);

    expect(caption().value).toBe("");
  });

  it("keeps the selection when nothing stored, so the retry is one click", () => {
    const { photos, caption, settleWith } = renderGallery([]);

    fill(photos(), caption());

    settleWith([]);

    expect(photos().files).toHaveLength(1);
    expect(caption().value).toBe("A long table");
  });

  it("leaves a filled form alone when a photo is deleted", () => {
    const { photos, caption, settleWith } = renderGallery([
      entry("one"),
      entry("two"),
    ]);

    fill(photos(), caption());

    settleWith([entry("one")]);

    expect(photos().files).toHaveLength(1);
    expect(caption().value).toBe("A long table");
  });
});
