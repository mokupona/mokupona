import { Outlet, useMatches } from "react-router";

import type { Route } from "./+types/admin";

import { AdminTabs } from "~/components/admin-tabs";
import { RouteErrorContent } from "~/components/route-error-content";
import { PageContainer } from "~/components/section";
import {
  requireResolvedUserRoleMiddleware,
  userContext,
} from "~/features/auth/middleware.server";
import { ADMIN_ROLE_NAMES, isAdminRole } from "~/features/auth/roles";
import { cn } from "~/lib/utils";
import { countAddresses } from "~/models/address.server";
import { countBoardMembers } from "~/models/board-member.server";
import { countEvents } from "~/models/event.server";
import { countUsers } from "~/models/user.server";
import { countVolunteers } from "~/models/volunteer.server";
import type { RouteHandle } from "~/root";

// admin text sits in cards and tables, so no halo behind it
export const handle: RouteHandle = { textHalo: false };

export const middleware: Route.MiddlewareFunction[] = [
  requireResolvedUserRoleMiddleware(ADMIN_ROLE_NAMES),
];

export async function loader({ context }: Route.LoaderArgs) {
  const user = context.get(userContext);
  const isAdmin = isAdminRole(user.role.name);

  const [events, locations, board, volunteers, users] = await Promise.all([
    countEvents(),
    countAddresses(),
    countBoardMembers(),
    countVolunteers(),
    isAdmin ? countUsers() : Promise.resolve(null),
  ]);

  return { counts: { events, locations, board, volunteers, users }, isAdmin };
}

export const meta: Route.MetaFunction = () => {
  return [{ title: "Admin" }];
};

/**
 * A page that holds a wide table sets `handle = { wideLayout: true }`; one
 * that should take the whole window, like a sheet used during a dinner, sets
 * `wideLayout: "full"`.
 */
function wideLayoutOf(
  matches: ReturnType<typeof useMatches>,
): boolean | "full" {
  let wide: boolean | "full" = false;
  for (const match of matches) {
    const value = (
      match.handle as { wideLayout?: boolean | "full" } | undefined
    )?.wideLayout;
    if (value === "full") return "full";
    if (value) wide = true;
  }
  return wide;
}

export default function AdminLayout({ loaderData }: Route.ComponentProps) {
  const wide = wideLayoutOf(useMatches());

  return (
    <>
      <AdminTabs counts={loaderData.counts} isAdmin={loaderData.isAdmin} />
      <PageContainer
        className={cn(
          "grow pt-7 pb-20",
          wide === "full" ? "max-w-none md:px-6" : wide && "max-w-7xl",
        )}
      >
        <Outlet />
      </PageContainer>
    </>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  return (
    <PageContainer className="grow pt-7 pb-20">
      <RouteErrorContent error={error} />
    </PageContainer>
  );
}
