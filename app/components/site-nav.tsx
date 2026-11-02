import { ChevronRightIcon, XIcon } from "lucide-react";
import {
  useEffect,
  useState,
  type ComponentProps,
  type ElementType,
} from "react";
import { Form, Link, useLocation } from "react-router";

import { BrandLockup } from "./brand-lockup";
import { Glow } from "./section";
import { buttonVariants } from "./ui/button";

import { InstagramIcon } from "~/components/icons";
import { ADMIN_ROLE_NAMES } from "~/features/auth/roles";
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
}: {
  loggedIn: boolean;
  isModerator: boolean;
}): NavItem[] {
  const items: NavItem[] = [
    {
      kind: "link",
      label: "events",
      to: "/events",
      // an event's album belongs to the gallery tab, not this one
      isActive: (pathname) =>
        pathname.startsWith("/events") && !pathname.endsWith("/gallery"),
    },
    {
      kind: "link",
      label: "gallery",
      to: "/gallery",
      // per-event albums live under /events/:id/gallery, so also light up
      // this tab when the reader is inside one
      isActive: (pathname) =>
        pathname.startsWith("/gallery") || pathname.endsWith("/gallery"),
    },
    {
      kind: "link",
      label: "about",
      to: "/about",
      isActive: (pathname) => pathname.startsWith("/about"),
    },
    { kind: "instagram" },
  ];

  if (isModerator) {
    items.push({
      kind: "link",
      label: "admin area",
      to: "/admin",
      prefetch: "intent",
      isActive: (pathname) => pathname.startsWith("/admin"),
    });
  }

  if (loggedIn) {
    items.push(
      {
        kind: "link",
        label: "account",
        to: "/me",
        isActive: (pathname) => pathname === "/me",
      },
      { kind: "logout" },
    );
  } else {
    items.push({
      kind: "link",
      label: "login",
      to: "/login",
      isActive: (pathname) => pathname.startsWith("/login"),
    });
  }

  return items;
}

export function SiteNav({ joinHref }: { joinHref: string }) {
  const optionalUser = useOptionalUser();
  const loggedIn = Boolean(optionalUser);
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  const isModerator = (ADMIN_ROLE_NAMES as readonly string[]).includes(
    optionalUser?.role.name ?? "",
  );

  const navItems = buildNavItems({ loggedIn, isModerator });

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
      <nav className="relative border-b">
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
                      <span className="sr-only">instagram</span>
                    </a>
                  );
                case "logout":
                  return (
                    <Form key="logout" action="/logout" method="POST">
                      <button className={sectionLinkClasses(false)}>
                        logout
                      </button>
                    </Form>
                  );
              }
            })}

            <Link to={joinHref} className={buttonVariants({ size: "sm" })}>
              join an event
            </Link>
          </div>
        </div>

        <div className="flex h-14 items-center justify-between px-5 md:hidden">
          <BrandLockup to="/" showWordmark={false} logoClassName="size-10" />
          <button
            type="button"
            aria-label="Open menu"
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
        <MobileMenu
          joinHref={joinHref}
          navItems={navItems}
          onClose={() => setMenuOpen(false)}
        />
      ) : null}
    </>
  );
}

function MobileMenu({
  joinHref,
  navItems,
  onClose: closeMenu,
}: {
  joinHref: string;
  navItems: NavItem[];
  onClose: () => void;
}) {
  return (
    <div className="bg-background fixed inset-0 z-50 flex flex-col overflow-hidden md:hidden">
      <Glow strong className="-top-10 -right-10 size-72" />

      <div className="relative border-b">
        <div className="flex h-14 items-center justify-between px-5">
          <BrandLockup to="/" showWordmark={false} logoClassName="size-10" />
          <button
            type="button"
            aria-label="Close menu"
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
                      logout
                    </MobileMenuLink>
                  </Form>
                );
            }
          })}
        </div>

        <Link
          to={joinHref}
          className={cn(buttonVariants({ size: "lg" }), "mt-8")}
        >
          join an event
        </Link>

        <div className="mt-auto flex flex-col gap-4 pt-9">
          <div className="text-foreground/80 flex gap-6 text-sm">
            <a href={INSTAGRAM_URL} target="_blank" rel="noopener noreferrer">
              instagram
            </a>
            <Link to="/privacy">privacy policy</Link>
            <Link to="/impressum">impressum</Link>
          </div>
          <span className="text-muted-foreground text-xs">
            made with love in zürich
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
