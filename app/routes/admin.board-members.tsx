import { PlusIcon, UserIcon } from "lucide-react";
import { Link, Outlet, useLocation } from "react-router";

import type { Route } from "./+types/admin.board-members";

import { AdminDeleteButton } from "~/components/admin-delete-button";
import {
  AdminEmptyState,
  AdminPageHeader,
  InitialsAvatar,
} from "~/components/admin-ui";
import { OptimizedImage } from "~/components/optimized-image";
import { buttonVariants } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { listBoardMembers } from "~/models/board-member.server";

export async function loader() {
  const boardMembers = await listBoardMembers();
  return { boardMembers };
}

export const meta: Route.MetaFunction = () => {
  return [{ title: "Admin - Board Members" }];
};

export default function AdminBoardMembersPage({
  loaderData,
}: Route.ComponentProps) {
  const { boardMembers } = loaderData;
  const location = useLocation();
  const formOpen = location.pathname !== "/admin/board-members";

  return (
    <div className="animate-page-in">
      <AdminPageHeader
        eyebrow={`${boardMembers.length} members`}
        title="Board members"
        subtitle="These profiles appear publicly on the moku pona website."
        actions={
          <Link to="new" className={buttonVariants()}>
            <PlusIcon className="size-4" />
            Add member
          </Link>
        }
      />

      {boardMembers.length > 0 ? (
        <div className="grid gap-3 md:grid-cols-2">
          {boardMembers.map((member, index) => (
            <BoardMemberCard key={member.id} member={member} seed={index} />
          ))}
        </div>
      ) : (
        <AdminEmptyState
          icon={<UserIcon className="size-6" />}
          title="No board members yet"
          description="Add the people behind moku pona — they show up on the public site."
          action={
            <Link to="new" className={buttonVariants()}>
              Add member
            </Link>
          }
        />
      )}

      {formOpen ? (
        <div className="mt-8 border-t pt-8">
          <Outlet />
        </div>
      ) : (
        <Outlet />
      )}
    </div>
  );
}

type BoardMember = Awaited<ReturnType<typeof loader>>["boardMembers"][number];

function BoardMemberCard({
  member,
  seed,
}: {
  member: BoardMember;
  seed: number;
}) {
  const { id, name, position, image } = member;

  return (
    <Card interactive className="flex flex-wrap items-center gap-3 p-4">
      {image ? (
        <OptimizedImage
          image={image}
          alt={`Portrait of ${name}`}
          width={96}
          height={96}
          className="size-10 shrink-0"
        />
      ) : (
        <InitialsAvatar name={name} seed={seed} />
      )}
      <div className="min-w-0 flex-1">
        <h2 className="truncate text-base font-semibold">{name}</h2>
        <p className="text-muted-foreground mt-1 truncate text-sm">
          {position}
        </p>
      </div>
      <div className="flex shrink-0 gap-2">
        <Link
          to={`${id}/edit`}
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          Edit
        </Link>
        <AdminDeleteButton action={`${id}/delete`} />
      </div>
    </Card>
  );
}
