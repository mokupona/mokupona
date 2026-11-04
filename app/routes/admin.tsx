import { Outlet } from "react-router";

import type { Route } from "./+types/admin";

import { AdminTabs } from "~/components/admin-tabs";
import { RouteErrorContent } from "~/components/route-error-content";
import { PageContainer } from "~/components/section";
import {
  requireResolvedUserRoleMiddleware,
  userContext,
} from "~/features/auth/middleware.server";
import { ADMIN_ROLE_NAMES, isAdminRole } from "~/features/auth/roles";
import { countAddresses } from "~/models/address.server";
import { countBoardMembers } from "~/models/board-member.server";
import { countEvents } from "~/models/event.server";
import { countUsers } from "~/models/user.server";
import { countVolunteers } from "~/models/volunteer.server";

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

export default function AdminLayout({ loaderData }: Route.ComponentProps) {
  return (
    <>
      <AdminTabs counts={loaderData.counts} isAdmin={loaderData.isAdmin} />
      <PageContainer className="grow pt-7 pb-20">
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
