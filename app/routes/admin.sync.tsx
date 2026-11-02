import { parseWithZod } from "@conform-to/zod/v4";
import { DownloadIcon, RefreshCwIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Form, useNavigation } from "react-router";
import { z } from "zod";

import type { Route } from "./+types/admin.sync";

import { AdminPageHeader } from "~/components/admin-ui";
import { CheckboxField, ErrorList } from "~/components/forms";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import {
  requestLoggerContext,
  requireResolvedUserRoleMiddleware,
  userContext,
} from "~/features/auth/middleware.server";
import { readLiveDataSetup } from "~/features/live-data/config.server";
import {
  checkLiveDataSource,
  importLiveData,
  LiveDataImportError,
  type LiveDataImportResult,
} from "~/features/live-data/import.server";
import {
  LIVE_DATA_TABLE_LABELS,
  LIVE_DATA_TABLES,
  type LiveDataCounts,
} from "~/features/live-data/tables";
import { countLiveDataTables } from "~/models/live-data.server";
import { getDomainUrl } from "~/shared/http.server";
import { redirectWithToast } from "~/utils/toast.server";

export const middleware: Route.MiddlewareFunction[] = [
  requireResolvedUserRoleMiddleware(["admin"]),
];

const schema = z.object({
  includeSignups: z
    .literal("on")
    .optional()
    .transform((value) => value === "on"),
});

export async function loader({ request }: Route.LoaderArgs) {
  const setup = readLiveDataSetup();
  const here = await countLiveDataTables();

  // never the token: the page only learns which role this instance plays
  const status =
    setup.mode === "target"
      ? { mode: setup.mode, sourceOrigin: setup.sourceOrigin, problem: null }
      : setup.mode === "source"
        ? { mode: setup.mode, sourceOrigin: null, problem: null }
        : { mode: setup.mode, sourceOrigin: null, problem: setup.problem };

  const wantsCheck = new URL(request.url).searchParams.get("check") === "1";
  if (setup.mode !== "target" || !wantsCheck) {
    return { status, here, check: null };
  }

  try {
    const result = await checkLiveDataSource(setup, getDomainUrl(request));
    return {
      status,
      here,
      check: {
        ok: true as const,
        live: result.summary.counts,
        exportedAt: result.summary.exportedAt,
        schemaProblem: result.schemaProblem,
        imageStrategy: result.imageStrategy,
      },
    };
  } catch (error) {
    if (!(error instanceof LiveDataImportError)) throw error;
    return {
      status,
      here,
      check: { ok: false as const, message: error.message },
    };
  }
}

export async function action({ request, context }: Route.ActionArgs) {
  const setup = readLiveDataSetup();
  if (setup.mode !== "target") {
    throw new Response("Not found", { status: 404 });
  }

  const submission = parseWithZod(await request.formData(), { schema });
  if (submission.status !== "success" || !submission.value) {
    return submission.reply();
  }

  const log = context.get(requestLoggerContext);
  const audit = {
    userId: context.get(userContext).id,
    sourceOrigin: setup.sourceOrigin,
    includeSignups: submission.value.includeSignups,
  };

  let result: LiveDataImportResult;
  try {
    result = await importLiveData({
      setup,
      ownOrigin: getDomainUrl(request),
      includeSignups: submission.value.includeSignups,
    });
  } catch (error) {
    if (!(error instanceof LiveDataImportError)) throw error;
    log.warn({ ...audit, reason: error.message }, "Live data copy refused");
    return submission.reply({ formErrors: [error.message] });
  }

  log.warn(
    { ...audit, counts: result.counts, images: result.images },
    "Admin replaced this site's data with a copy of the live site",
  );

  return redirectWithToast("/admin/sync", {
    type: "success",
    title: "Live data copied",
    description: describeImport(result),
  });
}

function count(n: number, singular: string, plural = `${singular}s`) {
  return `${n} ${n === 1 ? singular : plural}`;
}

function describeImport({ counts, images }: LiveDataImportResult) {
  const parts = [
    count(counts.events, "event"),
    count(counts.addresses, "location"),
    count(counts.eventGalleryImages, "gallery photo"),
    count(counts.formSubmissions + counts.eventResponses, "signup"),
  ];
  if (images.strategy === "copy") {
    parts.push(
      `${count(images.copied, "image")} downloaded, ${images.reused} reused`,
    );
  }
  if (images.failed > 0) {
    parts.push(
      `${count(images.failed, "image")} couldn't be copied and ${images.failed === 1 ? "was" : "were"} left out`,
    );
  }
  return parts.join(", ");
}

export const meta: Route.MetaFunction = () => [{ title: "Admin - Sync" }];

export default function AdminSyncPage({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  const { status, here, check } = loaderData;
  const formErrors = actionData?.error?.[""] ?? undefined;

  return (
    <div className="animate-page-in">
      <AdminPageHeader
        eyebrow="sync"
        title="Live data"
        subtitle="Copy the live site's events, locations, photos and signups into this site."
      />

      <div className="flex flex-col gap-4">
        {status.mode === "target" ? (
          <TargetCard
            sourceOrigin={status.sourceOrigin}
            here={here}
            check={check}
            formErrors={formErrors}
          />
        ) : status.mode === "source" ? (
          <SourceCard />
        ) : (
          <SetupCard problem={status.problem} />
        )}

        <WhatMovesCard />
      </div>
    </div>
  );
}

type Check = Route.ComponentProps["loaderData"]["check"];

function TargetCard({
  sourceOrigin,
  here,
  check,
  formErrors,
}: {
  sourceOrigin: string;
  here: LiveDataCounts;
  check: Check;
  formErrors: string[] | undefined;
}) {
  const navigation = useNavigation();
  const checking =
    navigation.state === "loading" &&
    navigation.location.pathname === "/admin/sync" &&
    navigation.location.search.includes("check=1");

  return (
    <Card className="p-4 md:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold">Copy from the live site</h2>
            <Badge variant="info" pill>
              ready
            </Badge>
          </div>
          <p className="text-muted-foreground mt-1 text-sm break-all">
            Source: {sourceOrigin}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Form method="get" replace>
            <input type="hidden" name="check" value="1" />
            <Button
              type="submit"
              size="sm"
              variant="outline"
              disabled={checking}
            >
              <RefreshCwIcon className="size-4" />
              {checking ? "Checking…" : "Check live site"}
            </Button>
          </Form>
          <CopyDialog sourceOrigin={sourceOrigin} />
        </div>
      </div>

      <ErrorList errors={formErrors} />

      {check && !check.ok ? (
        <p className="text-destructive-light mt-4 text-sm">{check.message}</p>
      ) : null}

      {check?.ok && check.schemaProblem ? (
        <p className="text-destructive-light mt-4 text-sm">
          {check.schemaProblem}
        </p>
      ) : null}

      <CountsTable here={here} live={check?.ok ? check.live : null} />

      {check?.ok ? (
        <p className="text-muted-foreground mt-3 text-sm">
          {check.imageStrategy === "share"
            ? "Both sites use the same Cloudinary cloud, so photos are shared, not copied. Deleting them here never touches the live site's files."
            : "Photos are downloaded from the live site and stored with this site's own image storage. Photos copied on an earlier run are reused."}
        </p>
      ) : (
        <p className="text-muted-foreground mt-3 text-sm">
          Check the live site to compare and confirm the connection works.
        </p>
      )}
    </Card>
  );
}

function CountsTable({
  here,
  live,
}: {
  here: LiveDataCounts;
  live: LiveDataCounts | null;
}) {
  return (
    <div className="mt-4 overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-muted-foreground border-b text-left">
            <th className="py-2 pr-3 font-semibold">Data</th>
            <th className="py-2 pr-3 text-right font-semibold">Here now</th>
            <th className="py-2 text-right font-semibold">Live site</th>
          </tr>
        </thead>
        <tbody>
          {LIVE_DATA_TABLES.map((table) => (
            <tr key={table} className="border-b last:border-b-0">
              <td className="py-2 pr-3">{LIVE_DATA_TABLE_LABELS[table]}</td>
              <td className="py-2 pr-3 text-right tabular-nums">
                {here[table]}
              </td>
              <td className="py-2 text-right tabular-nums">
                {live ? live[table] : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CopyDialog({ sourceOrigin }: { sourceOrigin: string }) {
  const [open, setOpen] = useState(false);
  const navigation = useNavigation();
  const copying =
    navigation.state !== "idle" && navigation.formMethod === "POST";

  // close once the copy settles; success toasts, failure shows on the card
  const wasCopying = useRef(false);
  useEffect(() => {
    if (copying) {
      wasCopying.current = true;
    } else if (wasCopying.current) {
      wasCopying.current = false;
      setOpen(false);
    }
  }, [copying]);

  return (
    <Dialog open={open} onOpenChange={(next) => !copying && setOpen(next)}>
      <DialogTrigger render={<Button size="sm" />}>
        <DownloadIcon className="size-4" />
        Copy live data
      </DialogTrigger>
      <DialogContent showClose={!copying}>
        <div className="flex flex-col gap-2">
          <DialogTitle>Replace this site&apos;s data?</DialogTitle>
          <DialogDescription>
            Every event, location, signup form, signup, gallery photo and board
            member on this site is deleted and replaced with the copy from{" "}
            <span className="break-all">{sourceOrigin}</span>. Users and logins
            stay as they are. The live site is only read, never changed.
          </DialogDescription>
        </div>

        <Form method="post" className="flex flex-col gap-4">
          <CheckboxField
            labelProps={{ children: "Include guests' signups" }}
            buttonProps={{
              name: "includeSignups",
              defaultChecked: true,
              disabled: copying,
            }}
            description="Names, emails, phone numbers and dietary notes. Leave unticked to copy events without them."
          />

          <div className="mt-1 flex gap-2">
            <DialogClose
              render={
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  disabled={copying}
                />
              }
            >
              Cancel
            </DialogClose>
            <Button
              type="submit"
              variant="destructive"
              className="flex-1"
              disabled={copying}
            >
              {copying ? "Copying…" : "Replace with live data"}
            </Button>
          </div>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function SourceCard() {
  return (
    <Card className="p-4 md:p-5">
      <div className="flex items-center gap-2">
        <h2 className="text-base font-semibold">This is the live site</h2>
        <Badge variant="secondary" pill>
          source
        </Badge>
      </div>
      <p className="text-muted-foreground mt-1 text-sm">
        Staging or a local copy holding the same LIVE_DATA_TOKEN can read this
        site&apos;s data. Nothing can be copied into this site, so its data
        can&apos;t be overwritten from here.
      </p>
    </Card>
  );
}

function SetupCard({ problem }: { problem: string | null }) {
  return (
    <Card className="p-4 md:p-5">
      <div className="flex items-center gap-2">
        <h2 className="text-base font-semibold">Not set up</h2>
        <Badge variant="secondary" pill>
          off
        </Badge>
      </div>
      {problem ? (
        <p className="text-destructive-light mt-2 text-sm">{problem}</p>
      ) : null}
      <ol className="text-muted-foreground mt-2 flex list-decimal flex-col gap-1 pl-5 text-sm">
        <li>
          On the live site, set <code>LIVE_DATA_TOKEN</code> to a long random
          secret (<code>openssl rand -hex 32</code>).
        </li>
        <li>
          On this site, set the same <code>LIVE_DATA_TOKEN</code> and{" "}
          <code>LIVE_DATA_SOURCE_URL</code> to the live site&apos;s address,
          e.g. <code>https://mokupona.ch</code>.
        </li>
        <li>Redeploy both, then come back here.</li>
      </ol>
    </Card>
  );
}

function WhatMovesCard() {
  return (
    <Card className="p-4 md:p-5">
      <h2 className="text-base font-semibold">What a copy includes</h2>
      <div className="mt-2 grid gap-4 text-sm md:grid-cols-2">
        <div>
          <p className="font-semibold">Replaced</p>
          <p className="text-muted-foreground mt-1">
            Events, locations, signup forms, gallery photos, board members and
            the images they show, plus guests&apos; signups unless you leave
            them out.
          </p>
        </div>
        <div>
          <p className="font-semibold">Never copied</p>
          <p className="text-muted-foreground mt-1">
            Users, passwords, Google sign-ins, sessions, invites and roles.
            Everyone keeps the login they have on this site; events created by
            someone who also has an account here stay linked to them.
          </p>
        </div>
      </div>
    </Card>
  );
}
