import { Link } from "react-router";

import type { Route } from "./+types/admin.stats";

import { AdminPageHeader } from "~/components/admin-ui";
import { chipVariants } from "~/components/section";
import { Card } from "~/components/ui/card";
import { formatAdminDateLine } from "~/features/events/date-format";
import {
  countOf,
  formatCount,
  formatShare,
  ShareBars,
  SignupFunnel,
  StatTile,
  VisitorsChart,
} from "~/features/stats/components/admin-stats-charts";
import {
  parseStatPeriod,
  STAT_PERIODS,
  type StatsReport,
} from "~/features/stats/report";
import { loadStatsReport } from "~/features/stats/report.server";

export async function loader({ request }: Route.LoaderArgs) {
  const days = parseStatPeriod(new URL(request.url).searchParams.get("days"));
  return { report: await loadStatsReport(days) };
}

export const meta: Route.MetaFunction = () => {
  return [{ title: "Admin - Statistics" }];
};

export const handle = { wideLayout: true };

export default function AdminStatsPage({ loaderData }: Route.ComponentProps) {
  const { report } = loaderData;
  const { period, totals } = report;
  const visitors = totals.visitors.value;

  return (
    <div className="animate-page-in flex flex-col gap-6">
      <AdminPageHeader
        eyebrow="Statistics"
        title="How the site is doing"
        subtitle="Who comes by, how they find us, and how many of them take a seat."
      />

      <nav aria-label="Period" className="flex flex-wrap gap-2">
        {STAT_PERIODS.map((days) => (
          <Link
            key={days}
            to={`?days=${days}`}
            preventScrollReset
            aria-current={days === period.days ? "page" : undefined}
            className={chipVariants({ active: days === period.days })}
          >
            {days === 365 ? "Last year" : `Last ${days} days`}
          </Link>
        ))}
      </nav>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label="Visitors"
          metric={totals.visitors}
          period={period.days}
        />
        <StatTile
          label="Page views"
          metric={totals.pageviews}
          period={period.days}
        />
        <StatTile
          label="Signups through the site"
          metric={totals.signups}
          period={period.days}
        />
        <StatTile
          label="QR code scans"
          metric={totals.qrScans}
          period={period.days}
        />
      </div>

      <Card as="section" className="flex flex-col gap-4 p-4 md:p-5">
        <h2 className="text-base font-semibold">
          Visitors per {report.chart.unit}
        </h2>
        <VisitorsChart chart={report.chart} />
      </Card>

      <EventsSection events={report.events} />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card as="section" className="flex flex-col gap-4 p-4 md:p-5">
          <div className="flex flex-col gap-1">
            <h2 className="text-base font-semibold">How visits start</h2>
            <p className="text-muted-foreground text-sm">
              What brought people to the first page of their visit. Apps like
              WhatsApp don&apos;t say they sent someone, so their links count as
              direct.
            </p>
          </div>
          <ShareBars
            rows={report.sources.map((source) => ({
              key: source.key,
              label: source.label,
              value: source.visits,
            }))}
            total={report.sources.reduce((sum, s) => sum + s.visits, 0)}
            unit="visits"
            empty="No visits in this period yet."
          />
        </Card>

        <Card as="section" className="flex flex-col gap-4 p-4 md:p-5">
          <div className="flex flex-col gap-1">
            <h2 className="text-base font-semibold">Most visited pages</h2>
            <p className="text-muted-foreground text-sm">
              By visitors; page views in brackets.
            </p>
          </div>
          <ShareBars
            rows={report.pages.map((page) => ({
              key: page.path,
              label: page.label,
              value: page.visitors,
              note: `(${formatCount(page.pageviews)})`,
            }))}
            total={visitors}
            empty="No page views in this period yet."
          />
        </Card>

        <Card as="section" className="flex flex-col gap-4 p-4 md:p-5">
          <h2 className="text-base font-semibold">Devices</h2>
          <ShareBars
            rows={report.devices.map((device) => ({
              key: device.device,
              label: device.label,
              value: device.visitors,
            }))}
            total={report.devices.reduce((sum, d) => sum + d.visitors, 0)}
            empty="No visitors in this period yet."
          />
        </Card>

        <Card as="section" className="flex flex-col gap-4 p-4 md:p-5">
          <div className="flex flex-col gap-1">
            <h2 className="text-base font-semibold">
              Links followed off the site
            </h2>
            <p className="text-muted-foreground text-sm">
              Clicks on Instagram, maps and other outside links.
            </p>
          </div>
          <ShareBars
            rows={report.outbound.map((link) => ({
              key: link.host,
              label: link.label,
              value: link.clicks,
              note: `${link.clicks === 1 ? "click" : "clicks"} · ${countOf(link.visitors, "visitors")}`,
            }))}
            total={0}
            empty="Nobody followed an outside link in this period."
          />
        </Card>
      </div>

      <AboutTheNumbers />
    </div>
  );
}

function EventsSection({ events }: { events: StatsReport["events"] }) {
  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-xl font-semibold">Events</h2>
        <p className="text-muted-foreground text-sm">
          From opening an event&apos;s page to taking a seat, and where its
          visitors came from. Upcoming events first.
        </p>
      </div>

      {events.length === 0 ? (
        <Card className="text-muted-foreground p-6 text-center text-sm">
          No event had visitors in this period.
        </Card>
      ) : (
        <ul className="grid gap-3 lg:grid-cols-2">
          {events.map((event) => (
            <li key={event.id}>
              <Card className="flex h-full flex-col gap-4 p-4 md:p-5">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <h3 className="min-w-0 text-base font-semibold">
                    <Link
                      to={`/admin/events/${event.id}`}
                      className="hover:underline"
                    >
                      {event.title}
                    </Link>
                  </h3>
                  <p className="text-muted-foreground text-xs">
                    {event.upcoming ? "Upcoming · " : null}
                    <time dateTime={event.date} suppressHydrationWarning>
                      {formatAdminDateLine(new Date(event.date))}
                    </time>
                  </p>
                </div>

                <SignupFunnel event={event} />

                <div className="flex flex-col gap-2">
                  <h4 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                    Visitors came from
                  </h4>
                  {event.sources.length === 0 ? (
                    <p className="text-muted-foreground text-sm">Nobody yet.</p>
                  ) : (
                    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                      {event.sources.map((source) => (
                        <li key={source.key}>
                          {source.label}{" "}
                          <span className="text-muted-foreground tabular-nums">
                            {formatCount(source.visitors)} (
                            {formatShare(source.visitors, event.visitors)})
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function AboutTheNumbers() {
  return (
    <Card as="section" className="flex flex-col gap-2 p-4 text-sm md:p-5">
      <h2 className="text-base font-semibold">About these numbers</h2>
      <ul className="text-muted-foreground flex list-disc flex-col gap-1 pl-5">
        <li>
          The team doesn&apos;t count: any browser a moderator or admin has
          signed in on is left out from then on, even after signing out. So are
          bots and search engines.
        </li>
        <li>
          A visitor is counted once a day. Someone who comes back another day
          counts again; no cookie or address is stored to recognise them.
        </li>
        <li>
          QR code scans come from the codes on each event&apos;s admin page. Any
          link can be tagged the same way by adding{" "}
          <code className="bg-foreground/5 px-1">?src=name</code>, for example
          in the Instagram bio, and shows up under that name.
        </li>
        <li>
          Signups count those stored through the site in this period; the
          signups page of each event has the full list.
        </li>
      </ul>
    </Card>
  );
}
