import { UsersIcon } from "lucide-react";
import { Form, Link, useNavigation } from "react-router";

import type { Route } from "./+types/admin.events.$eventId_.volunteers";

import {
  AdminEmptyState,
  AdminPageHeader,
  InitialsAvatar,
} from "~/components/admin-ui";
import { OptimizedImage } from "~/components/optimized-image";
import { BackLink } from "~/components/section";
import { Button, buttonVariants } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { Checkbox } from "~/components/ui/checkbox";
import { getEventById } from "~/models/event.server";
import {
  listVolunteers,
  listVolunteersForEvent,
  setEventVolunteers,
} from "~/models/volunteer.server";
import { requireFound } from "~/shared/http.server";
import { redirectWithToast } from "~/utils/toast.server";

export async function loader({ params }: Route.LoaderArgs) {
  const { eventId } = params;

  const [event, volunteers, credited] = await Promise.all([
    getEventById(eventId).then(requireFound),
    listVolunteers(),
    listVolunteersForEvent(eventId),
  ]);

  return {
    event: { id: event.id, title: event.title },
    volunteers,
    creditedIds: credited.map((volunteer) => volunteer.id),
  };
}

export async function action({ params, request }: Route.ActionArgs) {
  const { eventId } = params;
  requireFound(await getEventById(eventId));

  const formData = await request.formData();
  const submitted = formData
    .getAll("volunteerId")
    .filter((value): value is string => typeof value === "string");

  // anything not on the roster (a volunteer deleted in another tab) is
  // dropped rather than failing the whole save
  const known = new Set((await listVolunteers()).map(({ id }) => id));
  await setEventVolunteers(
    eventId,
    submitted.filter((id) => known.has(id)),
  );

  return redirectWithToast(`/admin/events/${eventId}/volunteers`, {
    title: "Volunteers saved",
    description:
      "They'll be credited at the bottom of the event page once it's over.",
    type: "success",
  });
}

export const meta: Route.MetaFunction = ({ loaderData }) => {
  return [
    {
      title: loaderData
        ? `Admin - Event - ${loaderData.event.title} - Volunteers`
        : "Admin - Event - Volunteers",
    },
  ];
};

export default function EventVolunteersPage({
  loaderData,
}: Route.ComponentProps) {
  const { event, volunteers, creditedIds } = loaderData;
  const credited = new Set(creditedIds);
  const navigation = useNavigation();
  const saving = navigation.state === "submitting";

  return (
    <main className="animate-page-in">
      <BackLink to={`/admin/events/${event.id}`} prefetch="intent">
        {event.title}
      </BackLink>

      <AdminPageHeader
        eyebrow={`${creditedIds.length} of ${volunteers.length} volunteers credited`}
        title="Who helped?"
        subtitle="Ticked volunteers are thanked at the bottom of the public event page once the event has happened."
      />

      {volunteers.length > 0 ? (
        <Form method="POST" className="flex flex-col gap-6">
          <Card className="divide-y">
            {volunteers.map((volunteer, index) => (
              <label
                key={volunteer.id}
                className="hover:bg-foreground/5 flex cursor-pointer items-center gap-3 p-4 transition-colors"
              >
                <Checkbox
                  name="volunteerId"
                  value={volunteer.id}
                  defaultChecked={credited.has(volunteer.id)}
                />
                {volunteer.image ? (
                  <OptimizedImage
                    image={volunteer.image}
                    alt=""
                    width={96}
                    height={96}
                    className="size-10 shrink-0"
                  />
                ) : (
                  <InitialsAvatar name={volunteer.name} seed={index} />
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">
                    {volunteer.name}
                  </span>
                  {volunteer.role ? (
                    <span className="text-muted-foreground block truncate text-sm">
                      {volunteer.role}
                    </span>
                  ) : null}
                </span>
              </label>
            ))}
          </Card>

          <Button type="submit" className="self-start" disabled={saving}>
            {saving ? "Saving…" : "Save volunteers"}
          </Button>
        </Form>
      ) : (
        <AdminEmptyState
          icon={<UsersIcon className="size-6" />}
          title="No volunteers yet"
          description="Add volunteers first, then come back to credit them on this event."
          action={
            <Link to="/admin/volunteers/new" className={buttonVariants()}>
              Add volunteer
            </Link>
          }
        />
      )}
    </main>
  );
}
