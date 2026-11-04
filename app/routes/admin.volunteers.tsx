import { HeartHandshakeIcon, PlusIcon } from "lucide-react";
import { Link, Outlet, useLocation } from "react-router";

import type { Route } from "./+types/admin.volunteers";

import { AdminDeleteButton } from "~/components/admin-delete-button";
import {
  AdminEmptyState,
  AdminPageHeader,
  InitialsAvatar,
} from "~/components/admin-ui";
import { OptimizedImage } from "~/components/optimized-image";
import { buttonVariants } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { listVolunteers } from "~/models/volunteer.server";

export async function loader() {
  const volunteers = await listVolunteers();
  return { volunteers };
}

export const meta: Route.MetaFunction = () => {
  return [{ title: "Admin - Volunteers" }];
};

export default function AdminVolunteersPage({
  loaderData,
}: Route.ComponentProps) {
  const { volunteers } = loaderData;
  const location = useLocation();
  const formOpen = location.pathname !== "/admin/volunteers";

  return (
    <div className="animate-page-in">
      <AdminPageHeader
        eyebrow={`${volunteers.length} volunteers`}
        title="Volunteers"
        subtitle="These profiles appear on the about page, and on the past events they helped with."
        actions={
          <Link to="new" className={buttonVariants()}>
            <PlusIcon className="size-4" />
            Add volunteer
          </Link>
        }
      />

      {volunteers.length > 0 ? (
        <div className="grid gap-3 md:grid-cols-2">
          {volunteers.map((volunteer, index) => (
            <VolunteerCard
              key={volunteer.id}
              volunteer={volunteer}
              seed={index}
            />
          ))}
        </div>
      ) : (
        <AdminEmptyState
          icon={<HeartHandshakeIcon className="size-6" />}
          title="No volunteers yet"
          description="Add the people who cook, host and wash up — they show up on the about page."
          action={
            <Link to="new" className={buttonVariants()}>
              Add volunteer
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

type Volunteer = Awaited<ReturnType<typeof loader>>["volunteers"][number];

function VolunteerCard({
  volunteer,
  seed,
}: {
  volunteer: Volunteer;
  seed: number;
}) {
  const { id, name, role, image } = volunteer;

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
        {role ? (
          <p className="text-muted-foreground mt-1 truncate text-sm">{role}</p>
        ) : null}
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
