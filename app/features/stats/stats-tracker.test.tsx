import { act, fireEvent, render } from "@testing-library/react";
import { createMemoryRouter, Link, RouterProvider } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { StatsTracker, trackStat } from "./stats-tracker";

const sendBeacon = vi.fn((_url: string, _body?: BodyInit | null) => true);

function sent() {
  return sendBeacon.mock.calls.map(([url, body]) => ({
    url,
    body: JSON.parse(String(body)),
  }));
}

function renderAt(url: string, track = true) {
  window.history.replaceState(null, "", url);
  const page = (
    <>
      <StatsTracker track={track} />
      <Link to="/about">About</Link>
      <a href="https://www.instagram.com/mokupona">Instagram</a>
      <a href="/gallery">Gallery</a>
    </>
  );
  const router = createMemoryRouter(
    [
      { path: "/", element: page },
      { path: "/events/:id", element: page },
      { path: "/about", element: page },
      { path: "/admin", element: page },
    ],
    { initialEntries: [url] },
  );
  render(<RouterProvider router={router} />);
  return router;
}

beforeEach(() => {
  Object.defineProperty(navigator, "sendBeacon", {
    configurable: true,
    value: sendBeacon,
  });
  Object.defineProperty(document, "referrer", {
    configurable: true,
    value: "https://l.instagram.com/",
  });
});

afterEach(() => {
  sendBeacon.mockClear();
});

describe("StatsTracker", () => {
  it("reports the first page with where the visit came from", () => {
    renderAt("/events/abc");

    expect(sent()).toEqual([
      {
        url: "/api/stats",
        body: expect.objectContaining({
          kind: "pageview",
          path: "/events/abc",
          referrer: "https://l.instagram.com/",
          width: window.innerWidth,
        }),
      },
    ]);
  });

  it("reports a step within the site with the page it came from", async () => {
    const router = renderAt("/");

    await act(() => router.navigate("/about"));

    expect(sent().map(({ body }) => [body.path, body.from])).toEqual([
      ["/", undefined],
      ["/about", "/"],
    ]);
    expect(sent()[1].body.referrer).toBeUndefined();
  });

  it("passes a link's tag on, then takes it off the address bar", () => {
    renderAt("/events/abc?src=qr&x=1");

    expect(sent()[0].body.source).toBe("qr");
    expect(window.location.search).toBe("?x=1");
  });

  it("doesn't report pages that aren't counted", () => {
    renderAt("/admin");

    expect(sendBeacon).not.toHaveBeenCalled();
  });

  it("reports a click on a link off the site, but not one within it", () => {
    renderAt("/");
    sendBeacon.mockClear();

    fireEvent.click(document.querySelector('a[href^="https://"]')!);
    fireEvent.click(document.querySelector('a[href="/gallery"]')!);

    expect(sent().map(({ body }) => body)).toEqual([
      { kind: "outbound", path: "/", detail: "www.instagram.com" },
    ]);
  });

  it("reports nothing from a browser that isn't counted", () => {
    renderAt("/events/abc", false);
    trackStat({ kind: "signup_start", path: "/events/abc" });

    expect(sendBeacon).not.toHaveBeenCalled();
  });
});
