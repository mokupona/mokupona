import { NavLink } from "react-router";

import { cn } from "~/lib/utils";

export interface AdminTabCounts {
  events: number;
  locations: number;
  board: number;
  users: number | null;
}

const TABS = [
  { to: "/admin", label: "overview", end: true },
  { to: "/admin/events", label: "events", countKey: "events" },
  { to: "/admin/locations", label: "locations", countKey: "locations" },
  { to: "/admin/board-members", label: "board", countKey: "board" },
  { to: "/admin/users", label: "users", countKey: "users", adminOnly: true },
  { to: "/admin/settings", label: "settings", adminOnly: true },
  { to: "/admin/sync", label: "sync", adminOnly: true },
] as const;

export function AdminTabs({
  counts,
  isAdmin,
}: {
  counts: AdminTabCounts;
  isAdmin: boolean;
}) {
  return (
    <nav
      aria-label="Admin sections"
      className="scrollbar-hidden flex gap-5 overflow-x-auto border-b px-5 whitespace-nowrap md:gap-7 md:px-10"
    >
      {TABS.map((tab) => {
        if ("adminOnly" in tab && !isAdmin) return null;

        const count = "countKey" in tab ? counts[tab.countKey] : null;

        return (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={"end" in tab ? tab.end : false}
            prefetch="intent"
            className={({ isActive }) =>
              cn(
                "-mb-px inline-flex items-center gap-2 border-b-2 py-4 text-base font-semibold transition-colors",
                isActive
                  ? "border-primary text-foreground"
                  : "text-muted-foreground hover:text-foreground border-transparent",
              )
            }
          >
            {tab.label}
            {count !== null ? (
              <span className="text-muted-foreground bg-foreground/5 px-2 py-px text-xs font-semibold">
                {count}
              </span>
            ) : null}
          </NavLink>
        );
      })}
    </nav>
  );
}
