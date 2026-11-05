import { describe, expect, it } from "vitest";

import {
  clampCrop,
  cropColumns,
  cropFieldSchema,
  cropOf,
  cropPixels,
  framedImageStyle,
  framedSize,
  serializeCrop,
} from "./image-crop";

const columns = { cropX: 0.1, cropY: 0.2, cropWidth: 0.5, cropHeight: 0.4 };

describe("cropOf", () => {
  it("reads the four columns as a crop", () => {
    expect(cropOf(columns)).toEqual({
      x: 0.1,
      y: 0.2,
      width: 0.5,
      height: 0.4,
    });
  });

  it("has no crop without all four columns", () => {
    expect(cropOf({})).toBeNull();
    expect(cropOf({ ...columns, cropHeight: null })).toBeNull();
  });

  it("treats a crop of the whole photo, or a broken one, as none", () => {
    expect(
      cropOf({ cropX: 0, cropY: 0, cropWidth: 1, cropHeight: 1 }),
    ).toBeNull();
    expect(cropOf({ ...columns, cropWidth: 0.95 })).toBeNull();
    expect(cropOf({ ...columns, cropX: Number.NaN })).toBeNull();
    expect(cropOf({ ...columns, cropWidth: 0.001 })).toBeNull();
  });
});

describe("clampCrop", () => {
  it("pulls a crop back inside the photo", () => {
    expect(clampCrop({ x: -0.1, y: 0.9, width: 0.5, height: 0.5 })).toEqual({
      x: 0,
      y: 0.5,
      width: 0.5,
      height: 0.5,
    });
  });
});

describe("cropColumns", () => {
  it("writes a crop, and clears all four for none", () => {
    expect(cropColumns({ x: 0.1, y: 0.2, width: 0.5, height: 0.4 })).toEqual(
      columns,
    );
    expect(cropColumns(null)).toEqual({
      cropX: null,
      cropY: null,
      cropWidth: null,
      cropHeight: null,
    });
  });
});

describe("cropFieldSchema", () => {
  it("round-trips a serialized crop", () => {
    const crop = { x: 0.125, y: 0.25, width: 0.5, height: 0.375 };
    expect(cropFieldSchema.parse(serializeCrop(crop))).toEqual(crop);
  });

  it("reads empty as no crop and absent as no change", () => {
    expect(cropFieldSchema.parse("")).toBeNull();
    expect(cropFieldSchema.parse(undefined)).toBeUndefined();
  });

  it.each(["0.1 0.2 0.5", "a b c d", "0.6 0 0.5 0.5", "0 0 0 0.5"])(
    "refuses %j",
    (value) => {
      expect(cropFieldSchema.safeParse(value).success).toBe(false);
    },
  );
});

describe("cropPixels and framedSize", () => {
  it("cuts the crop in whole pixels", () => {
    expect(
      cropPixels(
        { x: 0.1, y: 0.2, width: 0.5, height: 0.4 },
        { width: 1200, height: 800 },
      ),
    ).toEqual({ x: 120, y: 160, width: 600, height: 320 });
  });

  it("gives the framed size, or the whole photo, or nothing to go on", () => {
    expect(framedSize({ width: 1200, height: 800, ...columns })).toEqual({
      width: 600,
      height: 320,
    });
    expect(framedSize({ width: 1200, height: 800 })).toEqual({
      width: 1200,
      height: 800,
    });
    expect(framedSize({ width: null, height: null, ...columns })).toBeNull();
  });
});

describe("framedImageStyle", () => {
  const photo = { width: 1200, height: 800 };
  const pct = (value: string) => Number.parseFloat(value) / 100;

  it("fills a frame of the crop's own shape with exactly the crop", () => {
    // a 600×400 crop from (300, 200): a 3:2 frame shows just that
    const style = framedImageStyle(
      { x: 0.25, y: 0.25, width: 0.5, height: 0.5 },
      photo,
      3 / 2,
    );

    expect(pct(style.width)).toBeCloseTo(2);
    expect(pct(style.height)).toBeCloseTo(2);
    expect(pct(style.left)).toBeCloseTo(-0.5);
    expect(pct(style.top)).toBeCloseTo(-0.5);
    expect(style.position).toBe("absolute");
  });

  it("covers a frame of another shape around the crop's middle", () => {
    // the same 3:2 crop in a square frame: its height fills the frame and
    // its sides overflow evenly
    const style = framedImageStyle(
      { x: 0.25, y: 0.25, width: 0.5, height: 0.5 },
      photo,
      1,
    );

    expect(pct(style.height)).toBeCloseTo(2);
    expect(pct(style.width)).toBeCloseTo(3);
    // the crop's centre (the photo's centre) lands in the frame's centre
    expect(pct(style.left) + pct(style.width) / 2).toBeCloseTo(0.5);
    expect(pct(style.top) + pct(style.height) / 2).toBeCloseTo(0.5);
  });
});
