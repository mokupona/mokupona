// @vitest-environment node
import { RouterContextProvider } from "react-router";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { signedInRequest } from "../../../test/auth-session";
import { buildEventData, ensureAuthRoles } from "../../../test/factories";

import { prisma } from "~/db.server";
import { getUserWithRole } from "~/features/auth/guards.server";
import { optionalUserContext } from "~/features/auth/middleware.server";
import type { RoleName } from "~/features/auth/roles";
import { createEvent, deleteEventsInTx } from "~/models/event.server";
import { action } from "~/routes/api.stats";

const BROWSER =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15";

const eventIds: string[] = [];

// other files' hits (a signup's) must not leak into these counts
beforeEach(async () => {
  await prisma.statHit.deleteMany();
});

afterEach(async () => {
  await prisma.statHit.deleteMany();
  const events = eventIds.splice(0);
  if (events.length > 0) {
    await prisma.$transaction((tx) =>
      deleteEventsInTx(tx, { id: { in: events } }),
    );
  }
});

async function makeEvent() {
  const event = await createEvent(await buildEventData());
  eventIds.push(event.id);
  return event.id;
}

function guestContext() {
  const context = new RouterContextProvider();
  context.set(optionalUserContext, async () => null);
  return context;
}

function beacon(
  body: unknown,
  headers: Record<string, string> = {},
  context = guestContext(),
) {
  return action({
    request: new Request("http://localhost:3000/api/stats", {
      method: "POST",
      body: typeof body === "string" ? body : JSON.stringify(body),
      headers: {
        "Content-Type": "text/plain;charset=UTF-8",
        "Sec-Fetch-Site": "same-origin",
        "User-Agent": BROWSER,
        "X-Real-IP": "203.0.113.7",
        ...headers,
      },
    }),
    context,
    params: {},
  } as unknown as Parameters<typeof action>[0]);
}

describe("POST /api/stats", () => {
  it("counts a page view, with how the visitor arrived", async () => {
    const eventId = await makeEvent();

    const response = await beacon({
      kind: "pageview",
      path: `/events/${eventId}`,
      source: "QR",
      width: 390,
    });

    expect(response.status).toBe(204);
    const [hit, ...rest] = await prisma.statHit.findMany();
    expect(rest).toHaveLength(0);
    expect(hit).toMatchObject({
      kind: "pageview",
      path: `/events/${eventId}`,
      eventId,
      source: "qr",
      referrer: null,
      device: "mobile",
    });
    expect(hit.day).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    // nothing that identifies the visitor is kept
    expect(JSON.stringify(hit)).not.toContain("203.0.113.7");
  });

  it("gives one browser the same code all day, and another browser its own", async () => {
    await beacon({ kind: "pageview", path: "/" });
    await beacon({ kind: "pageview", path: "/about", from: "/" });
    await beacon(
      { kind: "pageview", path: "/" },
      { "X-Real-IP": "198.51.100.20" },
    );

    const hits = await prisma.statHit.findMany({
      orderBy: { createdAt: "asc" },
    });
    expect(hits).toHaveLength(3);
    expect(hits[0].visitor).toBe(hits[1].visitor);
    expect(hits[2].visitor).not.toBe(hits[0].visitor);
    expect(hits[1]).toMatchObject({ source: "internal", referrer: "/" });
  });

  it("keeps an invite token out of the stored path", async () => {
    await beacon({ kind: "pageview", path: "/invite/very-secret-token" });

    expect(await prisma.statHit.findMany()).toMatchObject([
      { path: "/invite" },
    ]);
  });

  it("stores the host of a link followed off the site", async () => {
    await beacon({
      kind: "outbound",
      path: "/",
      detail: "www.instagram.com",
    });

    expect(await prisma.statHit.findMany()).toMatchObject([
      { kind: "outbound", detail: "instagram.com", path: "/" },
    ]);
  });

  it.each([
    ["the admin area", { kind: "pageview", path: "/admin/events" }],
    ["an event that doesn't exist", { kind: "pageview", path: "/events/nope" }],
    ["an outbound click without a host", { kind: "outbound", path: "/" }],
  ])("ignores %s", async (_, body) => {
    expect((await beacon(body)).status).toBe(204);
    expect(await prisma.statHit.count()).toBe(0);
  });

  it("ignores a draft's page, which only the admin area shows", async () => {
    const eventId = await makeEvent();
    await prisma.event.update({
      where: { id: eventId },
      data: { published: false },
    });

    await beacon({ kind: "pageview", path: `/events/${eventId}` });

    expect(await prisma.statHit.count()).toBe(0);
  });

  it("ignores bots", async () => {
    await beacon(
      { kind: "pageview", path: "/" },
      {
        "User-Agent":
          "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
      },
    );

    expect(await prisma.statHit.count()).toBe(0);
  });

  it("ignores a browser marked as the team's", async () => {
    const response = await beacon(
      { kind: "pageview", path: "/" },
      { Cookie: "theme=x; stats_exclude=1" },
    );

    expect(response.status).toBe(204);
    expect(await prisma.statHit.count()).toBe(0);
  });

  it("ignores beacons from other sites", async () => {
    await beacon(
      { kind: "pageview", path: "/" },
      { "Sec-Fetch-Site": "cross-site" },
    );

    expect(await prisma.statHit.count()).toBe(0);
  });

  it("refuses a body that isn't a beacon", async () => {
    expect((await beacon("not json")).status).toBe(400);
    expect((await beacon({ kind: "signup", path: "/" })).status).toBe(400);
    expect((await beacon("x".repeat(5000))).status).toBe(413);
    expect(await prisma.statHit.count()).toBe(0);
  });

  describe("signed in", () => {
    async function signedInContext(roleName: RoleName) {
      await ensureAuthRoles();
      const { request } = await signedInRequest({ roleName, path: "/" });
      const context = new RouterContextProvider();
      const user = await getUserWithRole(request);
      context.set(optionalUserContext, async () => user);
      return { context, cookie: request.headers.get("cookie")! };
    }

    it.each(["moderator", "admin"] as const)(
      "leaves a %s out and marks their browser for good",
      async (roleName) => {
        const { context, cookie } = await signedInContext(roleName);

        const response = await beacon(
          { kind: "pageview", path: "/" },
          { Cookie: cookie },
          context,
        );

        expect(await prisma.statHit.count()).toBe(0);
        const setCookie = response.headers.get("Set-Cookie") ?? "";
        expect(setCookie).toMatch(/^stats_exclude=1;/);
        expect(setCookie).toContain("Max-Age=34560000");
        expect(setCookie).toContain("HttpOnly");
      },
    );

    it("counts a member who isn't on the team", async () => {
      const { context, cookie } = await signedInContext("user");

      const response = await beacon(
        { kind: "pageview", path: "/" },
        { Cookie: cookie },
        context,
      );

      expect(response.headers.get("Set-Cookie")).toBeNull();
      expect(await prisma.statHit.count()).toBe(1);
    });
  });
});
