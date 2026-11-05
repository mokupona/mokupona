import { redirect } from "react-router";

import type { Route } from "./+types/admin.events.$eventId_.gallery";

// Uploads moved to their own admin tab; old per-event links land there with
// the event already picked.
export function loader({ params }: Route.LoaderArgs) {
  return redirect(`/admin/gallery?event=${encodeURIComponent(params.eventId)}`);
}
