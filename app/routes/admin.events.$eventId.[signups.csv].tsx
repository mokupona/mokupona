import type { Route } from "./+types/admin.events.$eventId.[signups.csv]";

import {
  getAttendeeRosterForEvent,
  type Attendee,
  type RosterColumn,
} from "~/features/signup-form/read.server";
import type { SignupStatus } from "~/features/signup-form/signup-status";
import { getEventById } from "~/models/event.server";
import { contentDispositionAttachment } from "~/shared/content-disposition.server";
import { buildCSVObject } from "~/shared/csv-builder.server";
import { requireFound } from "~/shared/http.server";

export async function loader({ params }: Route.LoaderArgs) {
  const { eventId } = params;

  const [event, { attendees, columns }] = await Promise.all([
    getEventById(eventId).then(requireFound),
    getAttendeeRosterForEvent(eventId),
  ]);

  const data = buildCSVObject(
    ["Status", ...columns.map((column) => column.label)],
    attendees.map((attendee) => [
      STATUS_LABELS[attendee.status],
      ...toCsvRow(attendee, columns),
    ]),
  );

  const filename = `${event.title.split(" ").join("-")}-signups.csv`;

  return new Response(data.data, {
    headers: {
      "Content-Type": data.mimeType,
      "Content-Length": `${data.size}`,
      "Content-Disposition": contentDispositionAttachment(filename),
      "Cache-Control": "public, max-age=0, immutable",
    },
  });
}

const STATUS_LABELS: Record<SignupStatus, string> = {
  confirmed: "confirmed",
  waitlisted: "waiting list",
  cancelled: "cancelled",
};

function toCsvRow(attendee: Attendee, columns: RosterColumn[]) {
  return columns.map((column) => formatAnswer(attendee.answers[column.name]));
}

function formatAnswer(value: string | boolean | undefined): string {
  if (value === undefined) return "";
  if (typeof value === "boolean") return value ? "true" : "false";
  return value;
}
