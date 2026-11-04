import { DownloadIcon } from "lucide-react";
import { Fragment, useState } from "react";
import { data, Form, useFetcher } from "react-router";

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
import { Textarea } from "~/components/ui/textarea";
import {
  requestLoggerContext,
  userContext,
} from "~/features/auth/middleware.server";
import { formatAdminTimestamp } from "~/features/events/date-format";
import type {
  BookingGuest,
  SummaryRow,
} from "~/features/signup-form/booking-summary";
import {
  getSignupBookingsForEvent,
  type SignupBooking,
} from "~/features/signup-form/bookings.server";
import { MAX_ADMIN_NOTE_LENGTH } from "~/features/signup-form/bookkeeping";
import { sendSeatConfirmedMail } from "~/features/signup-form/confirmation-mail.server";
import {
  summarizeHeadcount,
  type HeadcountSummary,
} from "~/features/signup-form/headcount";
import {
  formatCHF,
  summarizeRevenue,
  type RevenueSummary,
} from "~/features/signup-form/revenue";
import {
  seatsLeft,
  type SignupStatus,
} from "~/features/signup-form/signup-status";
import { getText } from "~/features/site-text/site-text.server";
import { cn } from "~/lib/utils";
import {
  DuplicateSignupError,
  getSeatCounts,
  SignupNotFoundError,
  updateSignupBookkeeping,
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
  /** What the whole party pays, in CHF. */
  total: number;
  createdAt: Date;
  /** The signer first, then their friends, each with their price and answers. */
  guests: BookingGuest[];
  /** Answers that belong to the signup as a whole. */
  contact: SummaryRow[];
  /** Admin bookkeeping: whether each half of the payment is in. */
  firstHalfPaid: boolean;
  secondHalfPaid: boolean;
  /** Admin bookkeeping: free text for the team, never shown to the guest. */
  adminNote: string;
}

function toParty(signup: SignupBooking): Party {
  const { guests, contact, total } = signup.booking;

  return {
    submissionId: signup.submissionId,
    status: signup.status,
    isLegacy: signup.isLegacy,
    name: guests[0]?.name ?? "",
    email: signup.signerEmail,
    size: guests.length,
    total,
    createdAt: signup.createdAt,
    guests,
    contact,
    firstHalfPaid: signup.firstHalfPaid,
    secondHalfPaid: signup.secondHalfPaid,
    adminNote: signup.adminNote,
  };
}

export async function loader({ params }: Route.LoaderArgs) {
  const { eventId } = params;

  const event = await getEventById(eventId).then(requireFound);
  const prices = { price: event.price, studentPrice: event.studentPrice };
  const t = await getText();

  const [bookings, seats] = await Promise.all([
    getSignupBookingsForEvent(eventId, prices, t),
    getSeatCounts(eventId),
  ]);

  // oldest first, so the waiting list reads in the order people joined
  const parties = bookings.map(toParty);

  return {
    event: {
      title: event.title,
      slots: event.slots,
    },
    seats: { ...seats, left: seatsLeft(event.slots, seats.confirmed) },
    parties,
    revenue: summarizeRevenue(
      parties.map((party) => ({
        status: party.status,
        people: party.size,
        total: party.total,
      })),
    ),
    headcount: summarizeHeadcount(
      parties.map((party) => ({ status: party.status, guests: party.guests })),
    ),
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

  // the payment ticks and the note are the admin's own bookkeeping; they
  // don't touch the seats, so they skip the status rules below
  if (intent === "payments" || intent === "note") {
    const bookkeepingId = formData.get("submissionId");
    if (typeof bookkeepingId !== "string") {
      throw new Response("Bad Request", { status: 400 });
    }

    const update =
      intent === "payments"
        ? {
            firstHalfPaid: formData.has("firstHalfPaid"),
            secondHalfPaid: formData.has("secondHalfPaid"),
          }
        : { adminNote: readNote(formData) };

    try {
      await updateSignupBookkeeping({
        eventId,
        submissionId: bookkeepingId,
        data: update,
      });
    } catch (reason) {
      if (reason instanceof SignupNotFoundError) {
        throw new Response("Not Found", { status: 404 });
      }
      throw reason;
    }

    log.info(
      {
        userId: user.id,
        event: eventId,
        submission: bookkeepingId,
        changed: Object.keys(update),
      },
      "Admin updated a signup's bookkeeping",
    );

    return data({ saved: intent });
  }

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

function readNote(formData: FormData): string {
  const note = formData.get("note");
  if (typeof note !== "string" || note.length > MAX_ADMIN_NOTE_LENGTH) {
    throw new Response("Bad Request", { status: 400 });
  }
  return note.trim();
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

// the party table is wide; the admin layout gives this page the room it needs
export const handle = { wideLayout: true };

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
  const { event, seats, parties, revenue, headcount } = loaderData;
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

      <RevenueSummary revenue={revenue} />

      <Headcount headcount={headcount} />

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
          const total = rows.reduce((sum, party) => sum + party.total, 0);

          return (
            <section key={status} aria-labelledby={`signups-${status}`}>
              <h2
                id={`signups-${status}`}
                className="mb-3 text-lg font-semibold"
              >
                {title}{" "}
                <span className="text-muted-foreground text-sm font-normal">
                  {rows.length} {rows.length === 1 ? "group" : "groups"}
                  {status === "cancelled" ? null : ` · ${formatCHF(total)}`}
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

function RevenueSummary({ revenue }: { revenue: RevenueSummary }) {
  return (
    <section aria-labelledby="revenue-heading" className="mb-8">
      <h2 id="revenue-heading" className="sr-only">
        Expected revenue
      </h2>
      <div className="grid gap-3 md:grid-cols-3">
        <Stat
          label="Expected revenue"
          value={formatCHF(revenue.confirmedTotal)}
          note={`From ${people(revenue.confirmedPeople)} with a confirmed seat`}
          emphasis
        />
        <Stat
          label="Waiting list"
          value={formatCHF(revenue.waitlistTotal)}
          note={
            revenue.waitlistPeople === 0
              ? "Nobody is waiting"
              : `What ${people(revenue.waitlistPeople)} would pay if every group got a seat`
          }
        />
        <Stat
          label="Per person"
          value={
            revenue.averagePerPerson === null
              ? "—"
              : formatCHF(revenue.averagePerPerson)
          }
          note="Average over confirmed seats, students at the student price"
        />
      </div>
    </section>
  );
}

function Headcount({ headcount }: { headcount: HeadcountSummary }) {
  const { confirmed, waitlisted } = headcount;

  const rows = [
    {
      label: "People",
      confirmed: confirmed.people,
      waitlisted: waitlisted.people,
      strong: true,
    },
    {
      label: "Vegetarian",
      confirmed: confirmed.vegetarian,
      waitlisted: waitlisted.vegetarian,
    },
    {
      label: "Not vegetarian",
      confirmed: confirmed.notVegetarian,
      waitlisted: waitlisted.notVegetarian,
    },
    ...(confirmed.dietNotAsked + waitlisted.dietNotAsked > 0
      ? [
          {
            label: "Diet not asked on this form",
            confirmed: confirmed.dietNotAsked,
            waitlisted: waitlisted.dietNotAsked,
          },
        ]
      : []),
    {
      label: "Students",
      confirmed: confirmed.students,
      waitlisted: waitlisted.students,
    },
    {
      label: "Not students",
      confirmed: confirmed.notStudents,
      waitlisted: waitlisted.notStudents,
    },
  ];

  return (
    <section aria-labelledby="headcount-heading" className="mb-8">
      <h2 id="headcount-heading" className="mb-3 text-lg font-semibold">
        Headcount
      </h2>
      <Card>
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Who</TableHead>
              <TableHead className="text-right">Confirmed</TableHead>
              <TableHead className="text-right">Waiting list</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.label} className="hover:bg-transparent">
                <TableCell className={row.strong ? "font-semibold" : undefined}>
                  {row.label}
                </TableCell>
                <TableCell
                  className={cn(
                    "text-right tabular-nums",
                    row.strong && "font-semibold",
                  )}
                >
                  {row.confirmed}
                </TableCell>
                <TableCell className="text-muted-foreground text-right tabular-nums">
                  {row.waitlisted}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </section>
  );
}

function people(count: number) {
  return `${count} ${count === 1 ? "person" : "people"}`;
}

function Stat({
  label,
  value,
  note,
  emphasis = false,
}: {
  label: string;
  value: string;
  note: string;
  emphasis?: boolean;
}) {
  return (
    <Card className="flex flex-col gap-1 p-4 md:p-5">
      <span className="text-muted-foreground text-xs font-semibold tracking-widest uppercase">
        {label}
      </span>
      <span
        className={cn(
          "text-2xl font-semibold tabular-nums",
          emphasis && "text-primary",
        )}
      >
        {value}
      </span>
      <span className="text-muted-foreground text-sm">{note}</span>
    </Card>
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
  // the table scrolls sideways on a phone rather than being cut off
  return (
    <Card>
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead>Guest</TableHead>
            <TableHead>Email</TableHead>
            <TableHead className="text-center">Party</TableHead>
            <TableHead className="text-right">Price</TableHead>
            <TableHead>Payments</TableHead>
            <TableHead className="text-right">Signed up</TableHead>
            <TableHead className="text-right">
              <span className="sr-only">Actions</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {parties.map((party, index) => (
            <PartyRow
              key={party.submissionId}
              party={party}
              index={index}
              seatsLeft={seatsLeft}
            />
          ))}
          {parties.length === 0 ? (
            <TableRow className="hover:bg-transparent">
              <TableCell
                colSpan={7}
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

function PartyRow({
  party,
  index,
  seatsLeft,
}: {
  party: Party;
  index: number;
  seatsLeft: number;
}) {
  const [open, setOpen] = useState(false);
  const detailsId = `party-${party.submissionId}`;

  return (
    <>
      <TableRow>
        <TableCell>
          <div className="flex items-center gap-3">
            <InitialsAvatar
              name={party.name}
              seed={index}
              className="size-8 text-xs"
            />
            <div className="flex flex-col items-start gap-1">
              <span className="font-semibold">{party.name}</span>
              {party.adminNote ? (
                <span className="text-primary text-xs">Has a note</span>
              ) : null}
              <button
                type="button"
                aria-expanded={open}
                aria-controls={detailsId}
                onClick={() => setOpen((current) => !current)}
                className="text-primary text-xs hover:underline"
              >
                {open ? "Hide details" : "Show details"}
              </button>
            </div>
          </div>
        </TableCell>
        <TableCell className="text-muted-foreground">{party.email}</TableCell>
        <TableCell className="text-center">{party.size}</TableCell>
        <TableCell className="text-right font-semibold whitespace-nowrap tabular-nums">
          {formatCHF(party.total)}
        </TableCell>
        <TableCell>
          <PaymentTicks party={party} />
        </TableCell>
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
      {open ? (
        <TableRow className="hover:bg-transparent">
          <TableCell
            id={detailsId}
            colSpan={7}
            className="bg-foreground/[0.02] whitespace-normal"
          >
            <PartyDetails party={party} />
          </TableCell>
        </TableRow>
      ) : null}
    </>
  );
}

function PartyDetails({ party }: { party: Party }) {
  return (
    <div className="flex flex-col gap-4 py-3">
      {party.isLegacy ? null : <NoteForm party={party} />}

      {party.contact.length > 0 ? (
        <div className="flex flex-col gap-2">
          <p className="text-muted-foreground text-xs font-semibold tracking-widest uppercase">
            Signup
          </p>
          <AnswerList rows={party.contact} />
        </div>
      ) : null}

      <div className="grid gap-3 md:grid-cols-2">
        {party.guests.map((guest, guestIndex) => (
          <GuestCard key={guestIndex} guest={guest} signer={guestIndex === 0} />
        ))}
      </div>
    </div>
  );
}

function GuestCard({
  guest,
  signer,
}: {
  guest: BookingGuest;
  signer: boolean;
}) {
  const rows: SummaryRow[] = guest.email
    ? [["Their email", guest.email], ...guest.rows]
    : guest.rows;

  return (
    <div className="bg-background border p-3">
      <div className="flex items-baseline justify-between gap-3">
        <p className="font-semibold">
          {guest.name}
          {signer ? (
            <span className="text-muted-foreground ml-2 text-xs font-normal">
              signed up
            </span>
          ) : null}
        </p>
        <p className="text-sm font-semibold whitespace-nowrap tabular-nums">
          {formatCHF(guest.price)}
          {guest.isStudent ? (
            <span className="text-muted-foreground font-normal">
              {" "}
              · student
            </span>
          ) : null}
        </p>
      </div>
      <div className="mt-2">
        <AnswerList rows={rows} />
      </div>
    </div>
  );
}

function AnswerList({ rows }: { rows: readonly SummaryRow[] }) {
  return (
    <dl className="grid grid-cols-[minmax(0,auto)_minmax(0,1fr)] gap-x-4 gap-y-1 text-sm">
      {rows.map(([label, value], index) => (
        <Fragment key={`${index}-${label}`}>
          <dt className="text-muted-foreground">{label}</dt>
          <dd className="break-words">{value}</dd>
        </Fragment>
      ))}
    </dl>
  );
}

function PaymentTicks({ party }: { party: Party }) {
  const fetcher = useFetcher();

  if (party.isLegacy) {
    return <span className="text-muted-foreground text-sm">—</span>;
  }

  // the ticks are native checkboxes: a click shows at once, and each one is
  // remounted from the saved value once the page has reloaded its data
  return (
    <fetcher.Form
      method="post"
      className="flex flex-col items-start gap-1 text-sm"
    >
      <input type="hidden" name="intent" value="payments" />
      <input type="hidden" name="submissionId" value={party.submissionId} />
      <PaymentTick
        name="firstHalfPaid"
        label="1st half paid"
        checked={party.firstHalfPaid}
      />
      <PaymentTick
        name="secondHalfPaid"
        label="2nd half paid"
        checked={party.secondHalfPaid}
      />
    </fetcher.Form>
  );
}

function PaymentTick({
  name,
  label,
  checked,
}: {
  name: string;
  label: string;
  checked: boolean;
}) {
  return (
    <label className="inline-flex items-center gap-2 whitespace-nowrap">
      <input
        key={String(checked)}
        type="checkbox"
        name={name}
        defaultChecked={checked}
        onChange={(event) => event.currentTarget.form?.requestSubmit()}
        className="accent-primary size-4"
      />
      {label}
    </label>
  );
}

function NoteForm({ party }: { party: Party }) {
  const fetcher = useFetcher<typeof action>();
  const saved =
    fetcher.state === "idle" &&
    fetcher.data !== undefined &&
    "saved" in fetcher.data &&
    fetcher.data.saved === "note";
  const noteId = `note-${party.submissionId}`;

  return (
    <fetcher.Form method="post" className="flex flex-col gap-2">
      <input type="hidden" name="intent" value="note" />
      <input type="hidden" name="submissionId" value={party.submissionId} />
      <label htmlFor={noteId} className="text-sm font-semibold">
        Notes for us
      </label>
      <Textarea
        id={noteId}
        name="note"
        defaultValue={party.adminNote}
        rows={3}
        maxLength={MAX_ADMIN_NOTE_LENGTH}
        placeholder="Anything we have to remember about this group"
      />
      <div className="flex items-center gap-3">
        <Button
          type="submit"
          size="sm"
          variant="outline"
          disabled={fetcher.state !== "idle"}
        >
          Save note
        </Button>
        {saved ? (
          <span role="status" className="text-muted-foreground text-sm">
            Saved
          </span>
        ) : null}
      </div>
    </fetcher.Form>
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
