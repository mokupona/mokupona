import { ArrowDownIcon, ArrowUpIcon } from "lucide-react";
import { useState } from "react";

import type { ChartBucket, Metric, StatsReport } from "../report";

import { Card } from "~/components/ui/card";
import { cn } from "~/lib/utils";

const wholeNumber = new Intl.NumberFormat("en-GB");
const compactNumber = new Intl.NumberFormat("en-GB", {
  notation: "compact",
  maximumFractionDigits: 1,
});

export function formatCount(value: number) {
  return value >= 10_000
    ? compactNumber.format(value)
    : wholeNumber.format(value);
}

/** "1 visitor", "2 visitors": `unit` is the plural. */
export function countOf(value: number, unit: string) {
  return `${formatCount(value)} ${value === 1 ? unit.replace(/s$/, "") : unit}`;
}

export function formatShare(part: number, whole: number) {
  if (whole === 0) return "–";
  return `${Math.round((part / whole) * 100)}%`;
}

// day strings are calendar days, so they are read and printed in UTC
const dayLabel = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});
const shortDayLabel = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

function asDate(day: string) {
  return new Date(`${day}T00:00:00Z`);
}

export function bucketLabel({ start, end }: ChartBucket) {
  return start === end
    ? dayLabel.format(asDate(start))
    : `${shortDayLabel.format(asDate(start))} – ${shortDayLabel.format(asDate(end))}`;
}

/** The change against the period before, as an arrow and a percentage. */
function Delta({ metric, period }: { metric: Metric; period: number }) {
  const { value, previous } = metric;
  const vs = `vs previous ${period} days`;

  if (previous === 0) {
    return (
      <p className="text-muted-foreground text-xs">
        None in the previous {period} days{value === 0 ? " either" : ""}
      </p>
    );
  }

  const change = Math.round(((value - previous) / previous) * 100);
  if (change === 0) {
    return <p className="text-muted-foreground text-xs">No change {vs}</p>;
  }

  const up = change > 0;
  const Icon = up ? ArrowUpIcon : ArrowDownIcon;
  return (
    <p
      className={cn(
        "flex items-center gap-1 text-xs",
        // every figure here is better higher
        up ? "text-teal-deep" : "text-destructive-light",
      )}
    >
      <Icon aria-hidden className="size-3.5" />
      <span>
        {up ? "+" : "−"}
        {Math.abs(change)}% <span className="text-muted-foreground">{vs}</span>
      </span>
    </p>
  );
}

export function StatTile({
  label,
  metric,
  period,
  hint,
}: {
  label: string;
  metric: Metric;
  period: number;
  hint?: string;
}) {
  return (
    <Card className="flex flex-col gap-1.5 p-4">
      <p className="text-muted-foreground text-sm">{label}</p>
      <p className="text-3xl font-semibold tracking-tight">
        {formatCount(metric.value)}
      </p>
      <Delta metric={metric} period={period} />
      {hint ? <p className="text-muted-foreground text-xs">{hint}</p> : null}
    </Card>
  );
}

/** A round number at or above `value`, for the top of an axis. */
function niceCeiling(value: number) {
  if (value <= 4) return 4;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const step = [1, 2, 2.5, 5, 10].find((s) => s * magnitude >= value)!;
  return step * magnitude;
}

/**
 * Visitors over time, one column per day (per week past 90 days). Hover or
 * focus a column, or move along with the arrow keys, for its numbers; the
 * table below carries every value too.
 */
export function VisitorsChart({ chart }: { chart: StatsReport["chart"] }) {
  const { buckets, unit } = chart;
  const [active, setActive] = useState<number | null>(null);
  const top = niceCeiling(Math.max(0, ...buckets.map((b) => b.visitors)));
  const shown = active === null ? null : buckets[active];
  const peak = buckets.reduce<number | null>(
    (best, bucket, index) =>
      bucket.visitors > 0 &&
      (best === null || bucket.visitors > buckets[best].visitors)
        ? index
        : best,
    null,
  );

  function onKeyDown(event: React.KeyboardEvent) {
    const last = buckets.length - 1;
    const moves: Record<string, number> = {
      ArrowLeft: Math.max(0, (active ?? last + 1) - 1),
      ArrowRight: Math.min(last, (active ?? -1) + 1),
      Home: 0,
      End: last,
    };
    if (event.key in moves) {
      event.preventDefault();
      setActive(moves[event.key]);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {/* the readout for the column under the pointer or the keyboard */}
      <p aria-live="polite" className="text-muted-foreground min-h-5 text-sm">
        {shown ? (
          <>
            <span className="text-foreground font-semibold">
              {countOf(shown.visitors, "visitors")}
            </span>
            {" · "}
            {countOf(shown.pageviews, "page views")} · {bucketLabel(shown)}
          </>
        ) : peak !== null ? (
          <>
            Busiest {unit}:{" "}
            <span className="text-foreground font-semibold">
              {countOf(buckets[peak].visitors, "visitors")}
            </span>{" "}
            on {bucketLabel(buckets[peak])}
          </>
        ) : (
          "No visitors in this period yet."
        )}
      </p>

      <div className="flex gap-2">
        <div
          aria-hidden
          className="text-muted-foreground flex h-40 flex-col justify-between text-right text-xs tabular-nums"
        >
          <span className="-translate-y-1/2">{formatCount(top)}</span>
          <span>{formatCount(top / 2)}</span>
          <span className="translate-y-1/2">0</span>
        </div>

        <div
          role="group"
          aria-label={`Visitors per ${unit}. Use the arrow keys to read each ${unit}; the table below lists them all.`}
          tabIndex={0}
          onKeyDown={onKeyDown}
          onFocus={() => setActive((current) => current ?? buckets.length - 1)}
          onBlur={() => setActive(null)}
          onPointerLeave={() => setActive(null)}
          className="focus-visible:ring-ring relative flex h-40 min-w-0 flex-1 items-end border-b outline-none focus-visible:ring-2"
        >
          {/* hairline guides at the half and the top */}
          <div
            aria-hidden
            className="border-foreground/10 pointer-events-none absolute inset-x-0 top-0 border-t"
          />
          <div
            aria-hidden
            className="border-foreground/10 pointer-events-none absolute inset-x-0 top-1/2 border-t"
          />
          {buckets.map((bucket, index) => (
            <div
              key={bucket.start}
              onPointerEnter={() => setActive(index)}
              // the whole column is the hit target, not just the painted bar
              className="relative flex h-full min-w-0 flex-1 items-end justify-center px-px"
            >
              <div
                className={cn(
                  "w-full max-w-6 rounded-t-[4px] transition-colors",
                  active === index ? "bg-teal" : "bg-teal-deep",
                )}
                style={{
                  height: `${(bucket.visitors / top) * 100}%`,
                  minHeight: bucket.visitors > 0 ? 2 : 0,
                }}
              />
            </div>
          ))}
        </div>
      </div>

      <div
        aria-hidden
        className="text-muted-foreground ml-8 flex justify-between text-xs"
      >
        <span>{bucketLabel(buckets[0])}</span>
        <span>{bucketLabel(buckets[buckets.length - 1])}</span>
      </div>

      <details className="text-sm">
        <summary className="text-muted-foreground hover:text-foreground w-fit cursor-pointer">
          Show as a table
        </summary>
        <div className="mt-2 max-h-72 overflow-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-muted-foreground">
              <tr className="border-b">
                <th className="py-1.5 font-normal">
                  {unit === "week" ? "Week" : "Day"}
                </th>
                <th className="py-1.5 text-right font-normal">Visitors</th>
                <th className="py-1.5 text-right font-normal">Page views</th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {[...buckets].reverse().map((bucket) => (
                <tr key={bucket.start} className="border-b last:border-0">
                  <td className="py-1.5">{bucketLabel(bucket)}</td>
                  <td className="py-1.5 text-right">{bucket.visitors}</td>
                  <td className="py-1.5 text-right">{bucket.pageviews}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}

/**
 * Ranked rows: a name, its number, and a thin bar against the largest. The
 * numbers are printed, so the bars only help the eye compare.
 */
export function ShareBars({
  rows,
  total,
  unit = "visitors",
  empty,
}: {
  rows: { key: string; label: string; value: number; note?: string }[];
  /** what the shares are of; the bars are scaled to the largest row */
  total: number;
  unit?: string;
  empty: string;
}) {
  if (rows.length === 0) {
    return <p className="text-muted-foreground text-sm">{empty}</p>;
  }
  const largest = Math.max(...rows.map((row) => row.value));

  return (
    <ul className="flex flex-col gap-3">
      {rows.map((row) => (
        <li key={row.key} className="flex flex-col gap-1">
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0 truncate" title={row.label}>
              {row.label}
            </span>
            <span className="text-muted-foreground shrink-0 tabular-nums">
              <span className="text-foreground font-semibold">
                {formatCount(row.value)}
              </span>{" "}
              {row.note ??
                `${row.value === 1 ? unit.replace(/s$/, "") : unit} · ${formatShare(row.value, total)}`}
            </span>
          </div>
          <div className="bg-foreground/5 h-1.5 rounded-full">
            <div
              className="bg-teal-deep h-full rounded-full"
              style={{ width: `${(row.value / largest) * 100}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

const FUNNEL_STEPS = [
  { key: "visitors", label: "Opened the event page" },
  { key: "started", label: "Started the signup form" },
  { key: "submitted", label: "Pressed sign up" },
  { key: "signedUp", label: "Signed up" },
] as const;

/**
 * The way from the event page to a seat, each step as a share of the page's
 * visitors. Steps are counted per visitor, so one person pressing submit
 * three times is one.
 */
export function SignupFunnel({
  event,
}: {
  event: StatsReport["events"][number];
}) {
  const base = event.visitors;

  return (
    <ol className="flex flex-col gap-2.5">
      {FUNNEL_STEPS.map((step) => {
        const value = event[step.key];
        return (
          <li key={step.key} className="flex flex-col gap-1">
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span>{step.label}</span>
              <span className="text-muted-foreground tabular-nums">
                <span className="text-foreground font-semibold">
                  {formatCount(value)}
                </span>
                {step.key === "visitors"
                  ? null
                  : ` · ${formatShare(value, base)}`}
              </span>
            </div>
            <div className="bg-foreground/5 h-2 rounded-full">
              <div
                className="bg-teal-deep h-full rounded-full"
                style={{
                  width:
                    base > 0 ? `${Math.min(100, (value / base) * 100)}%` : 0,
                }}
              />
            </div>
          </li>
        );
      })}
    </ol>
  );
}
