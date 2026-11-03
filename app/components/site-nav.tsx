import { ChevronRightIcon, XIcon } from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
  type ComponentProps,
  type ElementType,
  type RefObject,
} from "react";
import { Form, Link, useLocation } from "react-router";

import { BrandLockup } from "./brand-lockup";
import { Glow } from "./section";

import { InstagramIcon } from "~/components/icons";
import { ADMIN_ROLE_NAMES } from "~/features/auth/roles";
import { useText } from "~/features/site-text/site-text-context";
import type { Text } from "~/features/site-text/text";
import { useOptionalUser } from "~/hooks/useOptionalUser";
import { cn } from "~/lib/utils";

const INSTAGRAM_URL = "https://instagram.com/mokupona";

type NavItem =
  | {
      kind: "link";
      label: string;
      to: string;
      isActive: (pathname: string) => boolean;
      prefetch?: "intent";
    }
  | { kind: "instagram" }
  | { kind: "logout" };

function buildNavItems({
  loggedIn,
  isModerator,
  t,
}: {
  loggedIn: boolean;
  isModerator: boolean;
  t: Text;
}): NavItem[] {
  const items: NavItem[] = [
    {
      kind: "link",
      label: t("site.nav.events"),
      to: "/events",
      // an event's album belongs to the gallery tab, not this one
      isActive: (pathname) =>
        pathname.startsWith("/events") && !pathname.endsWith("/gallery"),
    },
    {
      kind: "link",
      label: t("site.nav.gallery"),
      to: "/gallery",
      // per-event albums live under /events/:id/gallery, so also light up
      // this tab when the reader is inside one
      isActive: (pathname) =>
        pathname.startsWith("/gallery") || pathname.endsWith("/gallery"),
    },
    {
      kind: "link",
      label: t("site.nav.about"),
      to: "/about",
      isActive: (pathname) => pathname.startsWith("/about"),
    },
    { kind: "instagram" },
  ];

  if (isModerator) {
    items.push({
      kind: "link",
      label: t("site.nav.admin"),
      to: "/admin",
      prefetch: "intent",
      isActive: (pathname) => pathname.startsWith("/admin"),
    });
  }

  if (loggedIn) {
    items.push(
      {
        kind: "link",
        label: t("site.nav.account"),
        to: "/me",
        isActive: (pathname) => pathname === "/me",
      },
      { kind: "logout" },
    );
  }

  return items;
}

/**
 * `hideAtTop`: the page opens without a header. It's fixed, on solid paper,
 * and slides down with the scroll — one px per px from the very first one,
 * fully in once the page has scrolled its height, and back up the same way.
 * Keyboard focus inside it shows it outright. Decoration behind the page —
 * the landing page's glyphs — passes under it.
 */
export function SiteNav({ hideAtTop = false }: { hideAtTop?: boolean }) {
  const optionalUser = useOptionalUser();
  const t = useText();
  const navRef = useRef<HTMLElement>(null);
  useScrollReveal(navRef, hideAtTop);
  const loggedIn = Boolean(optionalUser);
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  const isModerator = (ADMIN_ROLE_NAMES as readonly string[]).includes(
    optionalUser?.role.name ?? "",
  );

  const navItems = buildNavItems({ loggedIn, isModerator, t });

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  const sectionLinkClasses = (active: boolean) =>
    cn(
      "hover:text-foreground pb-1",
      active && "text-foreground border-b border-primary",
    );

  return (
    <>
      <nav
        ref={navRef}
        // the glyph backdrop ignores the pointer over anything marked this way
        data-glyph-cover
        // until hydration places it, a hideAtTop header starts out of sight
        data-hidden={hideAtTop ? "" : undefined}
        className={cn(
          "relative border-b",
          // --nav-offset is set from the scroll position by useScrollReveal
          hideAtTop &&
            "bg-background fixed inset-x-0 top-0 z-40 [translate:0_var(--nav-offset,-100%)] focus-within:[translate:0_0] data-hidden:pointer-events-none data-hidden:focus-within:pointer-events-auto",
        )}
      >
        <div className="flex h-16 items-center justify-between px-10 max-md:hidden">
          <BrandLockup to="/" showWordmark={false} logoClassName="size-11" />

          <div className="text-foreground/80 flex items-center gap-7 text-sm">
            {navItems.map((item) => {
              switch (item.kind) {
                case "link":
                  return (
                    <Link
                      key={item.label}
                      to={item.to}
                      prefetch={item.prefetch}
                      className={sectionLinkClasses(
                        item.isActive(location.pathname),
                      )}
                    >
                      {item.label}
                    </Link>
                  );
                case "instagram":
                  return (
                    <a
                      key="instagram"
                      href={INSTAGRAM_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-foreground"
                    >
                      <InstagramIcon className="size-5" />
                      <span className="sr-only">{t("site.nav.instagram")}</span>
                    </a>
                  );
                case "logout":
                  return (
                    <Form key="logout" action="/logout" method="POST">
                      <button className={sectionLinkClasses(false)}>
                        {t("site.nav.logout")}
                      </button>
                    </Form>
                  );
              }
            })}
          </div>
        </div>

        <div className="flex h-14 items-center justify-between px-5 md:hidden">
          <BrandLockup to="/" showWordmark={false} logoClassName="size-10" />
          <button
            type="button"
            aria-label={t("site.nav.openMenu")}
            aria-expanded={menuOpen}
            className="flex flex-col gap-1 py-2"
            onClick={() => setMenuOpen(true)}
          >
            <span className="bg-foreground/80 h-0.5 w-5" />
            <span className="bg-foreground/80 h-0.5 w-5" />
          </button>
        </div>
      </nav>

      {menuOpen ? (
        <MobileMenu navItems={navItems} onClose={() => setMenuOpen(false)} />
      ) : null}
    </>
  );
}

/**
 * Slides a fixed header in with the scroll: its offset is -(its height) at
 * the top of the page and reaches 0 once the page has scrolled that far.
 * Written straight to the element each frame rather than through state, so
 * scrolling doesn't re-render the nav.
 */
function useScrollReveal(ref: RefObject<HTMLElement | null>, enabled: boolean) {
  useEffect(() => {
    const nav = ref.current;
    if (!enabled || !nav) return;
    let frame = 0;
    const place = () => {
      frame = 0;
      const height = nav.offsetHeight;
      const offset = Math.min(0, window.scrollY - height);
      nav.style.setProperty("--nav-offset", `${offset}px`);
      nav.toggleAttribute("data-hidden", offset <= -height);
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(place);
    };
    place();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      if (frame) cancelAnimationFrame(frame);
      nav.style.removeProperty("--nav-offset");
    };
  }, [ref, enabled]);
}

function MobileMenu({
  navItems,
  onClose: closeMenu,
}: {
  navItems: NavItem[];
  onClose: () => void;
}) {
  const t = useText();

  return (
    <div className="bg-background fixed inset-0 z-50 flex flex-col overflow-hidden md:hidden">
      <Glow strong className="-top-10 -right-10 size-72" />

      <div className="relative border-b">
        <div className="flex h-14 items-center justify-between px-5">
          <BrandLockup to="/" showWordmark={false} logoClassName="size-10" />
          <button
            type="button"
            aria-label={t("site.nav.closeMenu")}
            className="p-2"
            onClick={closeMenu}
          >
            <XIcon className="size-5" />
          </button>
        </div>
      </div>

      <div className="relative flex flex-1 flex-col overflow-y-auto px-5 pt-10 pb-8">
        <div className="flex flex-col">
          {navItems.map((item) => {
            switch (item.kind) {
              case "link":
                return (
                  <MobileMenuLink key={item.label} to={item.to}>
                    {item.label}
                  </MobileMenuLink>
                );
              case "instagram":
                return null;
              case "logout":
                return (
                  <Form key="logout" action="/logout" method="POST">
                    <MobileMenuLink as="button" className="w-full text-left">
                      {t("site.nav.logout")}
                    </MobileMenuLink>
                  </Form>
                );
            }
          })}
        </div>

        <div className="mt-auto flex flex-col gap-4 pt-9">
          <div className="text-foreground/80 flex gap-6 text-sm">
            <a href={INSTAGRAM_URL} target="_blank" rel="noopener noreferrer">
              {t("site.nav.instagram")}
            </a>
            <Link to="/privacy">{t("site.footer.privacy")}</Link>
            <Link to="/impressum">{t("site.footer.impressum")}</Link>
          </div>
          <span className="text-muted-foreground text-xs">
            {t("site.footer.tagline")}
          </span>
        </div>
      </div>
    </div>
  );
}

type MobileMenuLinkProps =
  | (ComponentProps<typeof Link> & { as?: never })
  | (Omit<ComponentProps<typeof Link>, "to"> & {
      as: ElementType;
      to?: never;
    });

function MobileMenuLink(props: MobileMenuLinkProps) {
  const { as, className, children, ...rest } = props;
  const Component = as ?? Link;

  return (
    <Component
      className={cn(
        "flex items-center justify-between border-b py-4 text-xl tracking-tight",
        className,
      )}
      {...rest}
    >
      {children}
      <ChevronRightIcon className="text-primary size-5" />
    </Component>
  );
}
