import { describe, expect, it } from "vitest";

import {
  clampFraming,
  cropFromFraming,
  framingFromCrop,
  INITIAL_FRAMING,
  MAX_ZOOM,
} from "./image-framing";

const landscape = { width: 3000, height: 2000 };
const portrait = { width: 1000, height: 1500 };

describe("cropFromFraming", () => {
  it("starts with the largest centred crop of the frame's shape", () => {
    // a square frame on a 3:2 photo: the full height, centred
    const crop = cropFromFraming(landscape, 1, INITIAL_FRAMING);

    expect(crop.height).toBeCloseTo(1);
    expect(crop.width * landscape.width).toBeCloseTo(2000);
    expect(crop.x).toBeCloseTo(1 / 6);
    expect(crop.y).toBeCloseTo(0);
  });

  it("zooming in narrows the crop around the middle", () => {
    const crop = cropFromFraming(landscape, 3 / 2, {
      zoom: 2,
      offset: { x: 0, y: 0 },
    });

    expect(crop).toEqual({
      x: expect.closeTo(0.25),
      y: expect.closeTo(0.25),
      width: expect.closeTo(0.5),
      height: expect.closeTo(0.5),
    });
  });

  it("moving the photo right shows more of its left side", () => {
    const crop = cropFromFraming(landscape, 3 / 2, {
      zoom: 2,
      offset: { x: 0.25, y: 0 },
    });

    expect(crop.x).toBeLessThan(0.25);
  });
});

describe("framingFromCrop", () => {
  it.each([
    ["a landscape photo in a 3:2 frame", landscape, 3 / 2],
    ["a landscape photo in a square frame", landscape, 1],
    ["a portrait photo in a 4:5 frame", portrait, 4 / 5],
  ])("gives back the framing a crop was made with: %s", (_, photo, aspect) => {
    const framing = clampFraming(photo, aspect, {
      zoom: 1.8,
      offset: { x: 0.1, y: -0.05 },
    });
    const crop = cropFromFraming(photo, aspect, framing);
    const again = framingFromCrop(photo, aspect, crop);

    expect(again.zoom).toBeCloseTo(framing.zoom);
    expect(again.offset.x).toBeCloseTo(framing.offset.x);
    expect(again.offset.y).toBeCloseTo(framing.offset.y);
  });

  it("starts fresh without a crop", () => {
    expect(framingFromCrop(landscape, 1, null)).toEqual(INITIAL_FRAMING);
  });

  it("shows a crop of another shape whole when the frame changes", () => {
    // 1200 × 400 pixels: a square of 1200 holds it whole
    const wide = { x: 0.3, y: 0.4, width: 0.4, height: 0.2 };
    const framing = framingFromCrop(landscape, 1, wide);
    const shown = cropFromFraming(landscape, 1, framing);

    // the square frame contains all of the wide crop, centred on it
    expect(shown.x).toBeCloseTo(wide.x);
    expect(shown.width).toBeCloseTo(wide.width);
    expect(shown.y).toBeLessThanOrEqual(wide.y);
    expect(shown.y + shown.height).toBeGreaterThanOrEqual(wide.y + wide.height);
    expect(shown.y + shown.height / 2).toBeCloseTo(wide.y + wide.height / 2);
  });
});

describe("clampFraming", () => {
  it("keeps the zoom in range and the photo covering the frame", () => {
    const framing = clampFraming(landscape, 3 / 2, {
      zoom: 10,
      offset: { x: 5, y: -5 },
    });

    expect(framing.zoom).toBe(MAX_ZOOM);
    const crop = cropFromFraming(landscape, 3 / 2, framing);
    expect(crop.x).toBeCloseTo(0);
    expect(crop.y + crop.height).toBeCloseTo(1);
  });
});
