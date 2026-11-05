// @vitest-environment node
import { faker } from "@faker-js/faker";
import { RouterContextProvider } from "react-router";
import { afterEach, describe, expect, it } from "vitest";

import { prisma } from "~/db.server";
import { action } from "~/routes/admin.images.$imageId.crop";

const storagePrefix = "test/framing/";

afterEach(async () => {
  await prisma.image.deleteMany({
    where: { storageKey: { startsWith: storagePrefix } },
  });
});

function makeImage(size: { width: number | null; height: number | null }) {
  return prisma.image.create({
    data: {
      contentType: "image/jpeg",
      storageKey: `${storagePrefix}${faker.string.uuid()}`,
      ...size,
    },
  });
}

// the admin layout's middleware has let a moderator through by now
function frame(imageId: string, body: Record<string, string>) {
  return action({
    params: { imageId },
    request: new Request(`http://localhost:3000/admin/images/${imageId}/crop`, {
      method: "POST",
      body: new URLSearchParams(body),
    }),
    context: new RouterContextProvider(),
  } as unknown as Parameters<typeof action>[0]);
}

function stored(id: string) {
  return prisma.image.findUniqueOrThrow({ where: { id } });
}

/** A `data()` reply's body and status, or a plain object's. */
function reply(result: Awaited<ReturnType<typeof action>>) {
  return "data" in result
    ? { status: result.init?.status ?? 200, body: result.data }
    : { status: 200, body: result };
}

describe("POST /admin/images/:imageId/crop", () => {
  it("stores the framing on the image", async () => {
    const image = await makeImage({ width: 1200, height: 800 });

    const result = reply(
      await frame(image.id, {
        crop: "0.1 0.2 0.5 0.4",
        width: "1200",
        height: "800",
      }),
    );

    expect(result).toEqual({ status: 200, body: { ok: true } });
    expect(await stored(image.id)).toMatchObject({
      cropX: 0.1,
      cropY: 0.2,
      cropWidth: 0.5,
      cropHeight: 0.4,
    });
  });

  it("clears the framing with an empty crop", async () => {
    const image = await makeImage({ width: 1200, height: 800 });
    await frame(image.id, {
      crop: "0 0 0.5 0.5",
      width: "1200",
      height: "800",
    });

    await frame(image.id, { crop: "", width: "1200", height: "800" });

    expect(await stored(image.id)).toMatchObject({
      cropX: null,
      cropY: null,
      cropWidth: null,
      cropHeight: null,
    });
  });

  it("fills in the size of a row stored without one, and only then", async () => {
    const legacy = await makeImage({ width: null, height: null });
    const known = await makeImage({ width: 1200, height: 800 });
    const body = { crop: "0 0 0.5 0.5", width: "640", height: "480" };

    await frame(legacy.id, body);
    await frame(known.id, body);

    expect(await stored(legacy.id)).toMatchObject({ width: 640, height: 480 });
    expect(await stored(known.id)).toMatchObject({ width: 1200, height: 800 });
  });

  it.each<Record<string, string>>([
    { crop: "0.9 0 0.5 0.5", width: "1200", height: "800" },
    { crop: "nonsense", width: "1200", height: "800" },
    { width: "1200", height: "800" },
    { crop: "0 0 0.5 0.5", width: "0", height: "800" },
  ])("refuses %o", async (body) => {
    const image = await makeImage({ width: 1200, height: 800 });

    expect(reply(await frame(image.id, body)).status).toBe(400);
    expect((await stored(image.id)).cropX).toBeNull();
  });

  it("answers 404 for a photo that is gone", async () => {
    const result = reply(
      await frame("no-such-image", {
        crop: "0 0 0.5 0.5",
        width: "1200",
        height: "800",
      }),
    );

    expect(result.status).toBe(404);
  });
});
