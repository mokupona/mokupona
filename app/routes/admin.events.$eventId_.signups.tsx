import { DownloadIcon } from "lucide-react";
import { Form } from "react-router";

import type { Route } from "./+types/admin.events.$eventId_.signups";

import { AdminPageHeader, InitialsAvatar } from "~/components/admin-ui";
import { BackLink } from "~/components/section";
import { Button, buttonVariants } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import {
  requestLoggerContext,
  userContext,
} from "~/features/auth/middleware.server";
import { formatAdminTimestamp } from "~/features/events/date-format";
import { sendSeatConfirmedMail } from "~/features/signup-form/confirmation-mail.server";
import {
  getAttendeesForEvent,
  type Attendee,
} from "~/features/signup-form/read.server";
import {
  seatsLeft,
  type SignupStatus,
} from "~/features/signup-form/signup-status";
import {
  DuplicateSignupError,
  getSeatCounts,
  SignupNotFoundError,
  updateSignupStatus,
} from "~/models/event-signup.server";
import { getEventById } from "~/models/event.server";
import { getDomainUrl, requireFound } from "~/shared/http.server";
import { redirectWithToast, type ToastInput } from "~/utils/toast.server";

interface Party {
  submissionId: string;
  status: SignupStatus;
  /** Rows from before signup forms: shown, but their status is fixed. */
  isLegacy: boolean;
  name: string;
  email: string;
  size: number;
  createdAt: Date;
}

function toParties(attendees: Attendee[]): Party[] {
  const parties = new Map<string, Party>();

  for (const attendee of attendees) {
    const existing = parties.get(attendee.submissionId);
    if (!existing) {
      parties.set(attendee.submissionId, {
        submissionId: attendee.submissionId,
        status: attendee.status,
        isLegacy: attendee.isSigner === null,
        name: attendee.name,
        email: attendee.email,
        size: 1,
        createdAt: attendee.createdAt,
      });
    } else {
      existing.size += 1;
      if (attendee.isSigner) {
        existing.name = attendee.name;
        existing.email = attendee.email;
      }
    }
  }

  return [...parties.values()];
}

export async function loader({ params }: Route.LoaderArgs) {
  const { eventId } = params;

  const [event, attendees, seats] = await Promise.all([
    getEventById(eventId).then(requireFound),
    getAttendeesForEvent(eventId),
    getSeatCounts(eventId),
  ]);

  return {
    event: { title: event.title, slots: event.slots },
    seats: { ...seats, left: seatsLeft(event.slots, seats.confirmed) },
    // oldest first, so the waiting list reads in the order people joined
    parties: toParties(attendees),
  };
}

const STATUS_BY_INTENT = {
  confirm: "confirmed",
  waitlist: "waitlisted",
  cancel: "cancelled",
} as const satisfies Record<string, SignupStatus>;

function isIntent(value: unknown): value is keyof typeof STATUS_BY_INTENT {
  return (
    typeof value === "string" &&
    Object.prototype.hasOwnProperty.call(STATUS_BY_INTENT, value)
  );
}

export async function action({ params, request, context }: Route.ActionArgs) {
  const { eventId } = params;
  const log = context.get(requestLoggerContext);
  const user = context.get(userContext);
  const page = `/admin/events/${eventId}/signups`;

  const formData = await request.formData();
  const intent = formData.get("intent");
  const submissionId = formData.get("submissionId");
  if (!isIntent(intent) || typeof submissionId !== "string") {
    throw new Response("Bad Request", { status: 400 });
  }
  const status = STATUS_BY_INTENT[intent];

  let previous: SignupStatus;
  try {
    ({ previous } = await updateSignupStatus({
      eventId,
      submissionId,
      status,
    }));
  } catch (reason) {
    if (reason instanceof SignupNotFoundError) {
      throw new Response("Not Found", { status: 404 });
    }
    if (reason instanceof DuplicateSignupError) {
      return redirectWithToast(page, {
        type: "error",
        title: "This signup can't be restored",
        description:
          "The same email address has signed up again since. Cancel the newer signup first.",
      });
    }
    throw reason;
  }

  if (previous === status) {
    return redirectWithToast(page, { title: "Nothing changed" });
  }

  log.info(
    {
      userId: user.id,
      event: eventId,
      submission: submissionId,
      from: previous,
      to: status,
    },
    "Admin changed a signup's status",
  );

  let mailFailed = false;
  if (status === "confirmed") {
    try {
      await sendSeatConfirmedMail({
        submissionId,
        origin: getDomainUrl(request),
      });
    } catch (error) {
      mailFailed = true;
      log.error(
        { event: eventId, submission: submissionId, error },
        "Failed to send the seat confirmed mail",
      );
    }
  }

  return redirectWithToast(page, statusToast(status, previous, mailFailed));
}

function statusToast(
  status: SignupStatus,
  previous: SignupStatus,
  mailFailed: boolean,
): ToastInput {
  switch (status) {
    case "confirmed":
      return mailFailed
        ? {
            type: "error",
            title: "Seat confirmed, but the email failed",
            description:
              "Please let them know yourself. The error is in the logs.",
          }
        : {
            type: "success",
            title: "Seat confirmed",
            description: "We've emailed them that their seat is confirmed.",
          };
    case "waitlisted":
      return {
        title: "Moved to the waiting list",
        description: "They haven't been emailed.",
      };
    case "cancelled":
      return {
        title: "Signup cancelled",
        description:
          previous === "confirmed"
            ? "Their seats are free again. They haven't been emailed."
            : "They haven't been emailed.",
      };
  }
}

export const meta: Route.MetaFunction = ({ loaderData }) => {
  return [
    {
      title: loaderData
        ? `Admin - Event - ${loaderData.event.title} - Signups`
        : "Admin - Event - Signups",
    },
  ];
};

const SECTIONS: { status: SignupStatus; title: string; empty: string }[] = [
  { status: "confirmed", title: "Confirmed", empty: "No confirmed seats yet." },
  {
    status: "waitlisted",
    title: "Waiting list",
    empty: "Nobody is waiting.",
  },
  { status: "cancelled", title: "Cancelled", empty: "" },
];

export default function EventSignupsPage({ loaderData }: Route.ComponentProps) {
  const { event, seats, parties } = loaderData;
  const waitingGroups = parties.filter(
    (party) => party.status === "waitlisted",
  ).length;
  const overbookedBy = seats.confirmed - event.slots;

  return (
    <main className="animate-page-in">
      <BackLink to="/admin/events" prefetch="intent">
        Events
      </BackLink>

      <AdminPageHeader
        eyebrow={[
          `${seats.confirmed} / ${event.slots} seats confirmed`,
          ...(seats.waitlisted > 0 ? [`${seats.waitlisted} waiting`] : []),
        ].join(" · ")}
        title={event.title}
        actions={
          <a
            href="signups.csv"
            className={buttonVariants({ variant: "outline" })}
          >
            <DownloadIcon className="size-4" />
            Export CSV
          </a>
        }
      />

      {overbookedBy > 0 ? (
        <Notice>
          This event is overbooked by {overbookedBy}{" "}
          {overbookedBy === 1 ? "seat" : "seats"}.
        </Notice>
      ) : seats.left > 0 && waitingGroups > 0 ? (
        <Notice>
          {seats.left} {seats.left === 1 ? "seat is" : "seats are"} free and{" "}
          {waitingGroups} {waitingGroups === 1 ? "group is" : "groups are"}{" "}
          waiting. Confirming a group emails them that their seat is confirmed.
        </Notice>
      ) : null}

      <div className="flex flex-col gap-6">
        {SECTIONS.map(({ status, title, empty }) => {
          const rows = parties.filter((party) => party.status === status);
          if (status === "cancelled" && rows.length === 0) return null;

          return (
            <section key={status} aria-labelledby={`signups-${status}`}>
              <h2
                id={`signups-${status}`}
                className="mb-3 text-lg font-semibold"
              >
                {title}{" "}
                <span className="text-muted-foreground text-sm font-normal">
                  {rows.length} {rows.length === 1 ? "group" : "groups"}
                </span>
              </h2>
              <PartyTable
                parties={rows}
                seatsLeft={seats.left}
                emptyText={empty}
              />
            </section>
          );
        })}
      </div>
    </main>
  );
}

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <p
      role="status"
      className="border-primary/35 bg-primary/10 mb-6 rounded-xl border px-4 py-3 text-sm"
    >
      {children}
    </p>
  );
}

function PartyTable({
  parties,
  seatsLeft,
  emptyText,
}: {
  parties: Party[];
  seatsLeft: number;
  emptyText: string;
}) {
  return (
    <Card className="overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead>Guest</TableHead>
            <TableHead>Email</TableHead>
            <TableHead className="text-center">Party</TableHead>
            <TableHead className="text-right">Signed up</TableHead>
            <TableHead className="text-right">
              <span className="sr-only">Actions</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {parties.map((party, index) => (
            <TableRow key={party.submissionId}>
              <TableCell>
                <div className="flex items-center gap-3">
                  <InitialsAvatar
                    name={party.name}
                    seed={index}
                    className="size-8 text-xs"
                  />
                  <span className="font-semibold">{party.name}</span>
                </div>
              </TableCell>
              <TableCell className="text-muted-foreground">
                {party.email}
              </TableCell>
              <TableCell className="text-center">{party.size}</TableCell>
              <TableCell className="text-right">
                <time
                  dateTime={new Date(party.createdAt).toISOString()}
                  suppressHydrationWarning
                  className="text-muted-foreground text-sm whitespace-nowrap"
                >
                  {formatAdminTimestamp(new Date(party.createdAt))}
                </time>
              </TableCell>
              <TableCell className="text-right">
                {party.isLegacy ? null : (
                  <PartyActions party={party} seatsLeft={seatsLeft} />
                )}
              </TableCell>
            </TableRow>
          ))}
          {parties.length === 0 ? (
            <TableRow className="hover:bg-transparent">
              <TableCell
                colSpan={5}
                className="text-muted-foreground py-8 text-center text-sm"
              >
                {emptyText}
              </TableCell>
            </TableRow>
          ) : null}
        </TableBody>
      </Table>
    </Card>
  );
}

function PartyActions({
  party,
  seatsLeft,
}: {
  party: Party;
  seatsLeft: number;
}) {
  const overBy = party.size - seatsLeft;

  return (
    <Form method="post" className="flex justify-end gap-2">
      <input type="hidden" name="submissionId" value={party.submissionId} />

      {party.status !== "confirmed" ? (
        <Button
          type="submit"
          name="intent"
          value="confirm"
          size="sm"
          onClick={(clickEvent) => {
            if (overBy <= 0) return;
            const ok = window.confirm(
              `Confirming ${party.name}'s group of ${party.size} overbooks the event by ${overBy} ${overBy === 1 ? "seat" : "seats"}. Confirm anyway?`,
            );
            if (!ok) clickEvent.preventDefault();
          }}
        >
          Confirm
        </Button>
      ) : null}

      {party.status !== "waitlisted" ? (
        <Button
          type="submit"
          name="intent"
          value="waitlist"
          size="sm"
          variant="outline"
        >
          Waiting list
        </Button>
      ) : null}

      {party.status !== "cancelled" ? (
        <Button
          type="submit"
          name="intent"
          value="cancel"
          size="sm"
          variant="destructive-outline"
        >
          Cancel
        </Button>
      ) : null}
    </Form>
  );
}
