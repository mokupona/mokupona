import type { LinksFunction } from "react-router";
import {
  data,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useMatches,
} from "react-router";

import type { Route } from "./+types/root";
import { Footer } from "./components/footer";
import { RouteErrorContent } from "./components/route-error-content";
import { SiteNav } from "./components/site-nav";
import { Toaster } from "./components/ui/sonner";
import { SitelenBackdrop } from "./features/sitelen/sitelen-backdrop";
import { useToast } from "./hooks/useToast";
import { getNextEvent } from "./models/event.server";
import { getDomainUrl } from "./shared/http.server";
import { getToast } from "./utils/toast.server";

import {
  optionalUserContext,
  requestLoggerMiddleware,
  resolveOptionalUserMiddleware,
} from "~/features/auth/middleware.server";
import { getHoneypotInputProps } from "~/features/forms/honeypot.server";
import stylesheet from "~/tailwind.css?url";

export const links: LinksFunction = () => [
  { rel: "stylesheet", href: stylesheet },
  { rel: "apple-touch-icon", sizes: "180x180", href: "/apple-touch-icon.png" },
  {
    rel: "icon",
    type: "image/png",
    sizes: "32x32",
    href: "/favicon-32x32.png",
  },
  {
    rel: "icon",
    type: "image/png",
    sizes: "16x16",
    href: "/favicon-16x16.png",
  },
  { rel: "manifest", href: "/site.webmanifest" },
];

export const middleware: Route.MiddlewareFunction[] = [
  requestLoggerMiddleware,
  resolveOptionalUserMiddleware,
];

export const loader = async ({ request, context }: Route.LoaderArgs) => {
  const domainUrl = getDomainUrl(request);
  const user = await context.get(optionalUserContext)();
  const nextEvent = await getNextEvent();
  const { toast, headers } = await getToast(request);
  const allowIndexing = process.env.ALLOW_INDEXING !== "false";
  const cypressSupport = process.env.CYPRESS_SUPPORT === "true";
  const imageProvider: "local" | "cloudinary" =
    process.env.IMAGE_PROVIDER === "cloudinary" ? "cloudinary" : "local";
  return data(
    {
      user,
      toast,
      domainUrl,
      allowIndexing,
      cypressSupport,
      nextEventId: nextEvent?.id ?? null,
      imageProvider,
      cloudinaryCloudName: process.env.CLOUDINARY_CLOUD_NAME ?? null,
      honeypot: getHoneypotInputProps(),
    },
    { headers: headers ?? undefined },
  );
};

export default function App({ loaderData }: Route.ComponentProps) {
  const { allowIndexing, cypressSupport } = loaderData;

  return (
    <html lang="en" className="h-full scroll-smooth">
      <head>
        {cypressSupport ? (
          <script data-cy-bootstrap suppressHydrationWarning>
            {"/* placeholder */"}
          </script>
        ) : null}
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        {allowIndexing ? null : (
          <meta name="robots" content="noindex, nofollow" />
        )}
        <Meta />
        <Links />
      </head>
      <body className="dark h-full scheme-dark">
        <Document
          toast={loaderData.toast}
          nextEventId={loaderData.nextEventId}
        />
        <ScrollRestoration />
        <Scripts />
        <Toaster />
      </body>
    </html>
  );
}

function Document({
  toast,
  nextEventId,
}: {
  toast: Route.ComponentProps["loaderData"]["toast"];
  nextEventId: string | null;
}) {
  useToast(toast);

  const joinHref = nextEventId ? `/events/${nextEventId}` : "/events";
  const handles = useMatches().map(
    (match) => (match.handle ?? {}) as RouteHandle,
  );
  // the deepest route that says anything wins
  const glyphs =
    [...handles].reverse().find((handle) => handle.glyphs)?.glyphs ?? "faint";
  const hideHeaderAtTop = handles.some((handle) => handle.hideHeaderAtTop);

  return (
    // The paper background lives here as well as on body. The glyph wallpaper
    // is a fixed layer rendered first, and nav, content and footer are
    // `relative` so they paint over it — no negative z-index, which iOS
    // Safari renders unreliably.
    <div className="bg-background isolate flex min-h-full flex-col">
      {glyphs === "none" ? null : (
        <SitelenBackdrop faint={glyphs === "faint"} />
      )}
      <SiteNav joinHref={joinHref} hideAtTop={hideHeaderAtTop} />
      <div className="relative flex grow flex-col">
        <Outlet />
      </div>
      <Footer />
    </div>
  );
}

/** What a route module may put in its `handle` export for the root layout. */
export type RouteHandle = {
  /**
   * The sitelen glyph wallpaper behind the page: "faint" (the default, for
   * pages full of content), "full" (the landing page) or "none".
   */
  glyphs?: "full" | "faint" | "none";
  /** start with no header and slide it in on scroll (see SiteNav) */
  hideHeaderAtTop?: boolean;
};

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  return <RouteErrorContent error={error} />;
}
