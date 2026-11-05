import { describe, expect, it } from "vitest";

import {
  addDays,
  classifySource,
  countedPath,
  deviceForWidth,
  eventIdForPath,
  normalizeSource,
  outboundHost,
  statsDay,
} from "./hit";

describe("countedPath", () => {
  it.each([
    ["/", "/"],
    ["/events", "/events"],
    ["/events/", "/events"],
    ["/events/cm9x2k3ab0001", "/events/cm9x2k3ab0001"],
    ["/events/cm9x2k3ab0001/gallery", "/events/cm9x2k3ab0001/gallery"],
    ["/gallery", "/gallery"],
    ["/about", "/about"],
    ["/privacy", "/privacy"],
  ])("counts %j as %j", (pathname, stored) => {
    expect(countedPath(pathname)).toBe(stored);
  });

  it("keeps an invite link's token out", () => {
    expect(countedPath("/invite/s3cr3t-token")).toBe("/invite");
  });

  it.each([
    "/admin",
    "/admin/events",
    "/api/stats",
    "/file/abc",
    "/healthcheck",
    "/events/a/b",
    "/no-such-page",
    "/events/<script>",
  ])("doesn't count %j", (pathname) => {
    expect(countedPath(pathname)).toBeNull();
  });
});

describe("eventIdForPath", () => {
  it("finds the event of its page and its album", () => {
    expect(eventIdForPath("/events/abc")).toBe("abc");
    expect(eventIdForPath("/events/abc/gallery")).toBe("abc");
    expect(eventIdForPath("/events")).toBeNull();
    expect(eventIdForPath("/gallery")).toBeNull();
  });
});

describe("deviceForWidth", () => {
  it("cuts at the layout breakpoints", () => {
    expect(deviceForWidth(390)).toBe("mobile");
    expect(deviceForWidth(767)).toBe("mobile");
    expect(deviceForWidth(768)).toBe("tablet");
    expect(deviceForWidth(1024)).toBe("desktop");
    expect(deviceForWidth(undefined)).toBe("unknown");
  });
});

describe("normalizeSource", () => {
  it("turns a hand-made tag into a short slug", () => {
    expect(normalizeSource("QR")).toBe("qr");
    expect(normalizeSource(" Insta Bio! ")).toBe("insta-bio");
    expect(normalizeSource("x".repeat(50))).toHaveLength(32);
  });

  it("refuses tags that would pass for the site's own labels", () => {
    expect(normalizeSource("internal")).toBeNull();
    expect(normalizeSource("direct")).toBeNull();
    expect(normalizeSource("!!!")).toBeNull();
  });
});

describe("classifySource", () => {
  const siteHost = "mokupona.ch";

  it("trusts a tagged link above everything else", () => {
    expect(
      classifySource({
        source: "qr",
        from: "/events",
        referrer: "https://l.instagram.com/",
        siteHost,
      }),
    ).toEqual({ source: "qr", referrer: null });
  });

  it("names the page a step within the site came from", () => {
    expect(classifySource({ from: "/events", siteHost })).toEqual({
      source: "internal",
      referrer: "/events",
    });
  });

  it("recognises the sites people arrive from", () => {
    expect(
      classifySource({ referrer: "https://l.instagram.com/?u=x", siteHost }),
    ).toEqual({ source: "instagram", referrer: "l.instagram.com" });
    expect(
      classifySource({ referrer: "https://www.google.ch/", siteHost }),
    ).toEqual({ source: "google", referrer: "google.ch" });
    expect(
      classifySource({ referrer: "https://www.tsri.ch/kultur", siteHost }),
    ).toEqual({ source: "tsri.ch", referrer: "tsri.ch" });
  });

  it("treats a full page load from the site itself as internal", () => {
    expect(
      classifySource({
        referrer: "https://www.mokupona.ch/events",
        siteHost: "www.mokupona.ch",
      }),
    ).toEqual({ source: "internal", referrer: "/events" });
  });

  it("calls a visit with nothing to go on direct", () => {
    expect(classifySource({ siteHost })).toEqual({
      source: "direct",
      referrer: null,
    });
    expect(classifySource({ referrer: "android-app://x", siteHost })).toEqual({
      source: "direct",
      referrer: null,
    });
  });
});

describe("outboundHost", () => {
  it("keeps a plain host and nothing else", () => {
    expect(outboundHost("www.instagram.com")).toBe("instagram.com");
    expect(outboundHost("maps.google.com")).toBe("maps.google.com");
    expect(outboundHost("localhost")).toBeNull();
    expect(outboundHost("evil.com/<script>")).toBeNull();
    expect(outboundHost(undefined)).toBeNull();
  });
});

describe("statsDay", () => {
  it("is the Zürich calendar day", () => {
    // 23:30 UTC on 4 November is already the 5th in Zürich
    expect(statsDay(new Date("2026-11-04T23:30:00Z"))).toBe("2026-11-05");
    expect(statsDay(new Date("2026-07-01T21:59:00Z"))).toBe("2026-07-01");
    expect(statsDay(new Date("2026-07-01T22:00:00Z"))).toBe("2026-07-02");
  });
});

describe("addDays", () => {
  it("steps whole calendar days, across months and the DST change", () => {
    expect(addDays("2026-11-05", -29)).toBe("2026-10-07");
    expect(addDays("2026-03-28", 2)).toBe("2026-03-30");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });
});
