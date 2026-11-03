import { ExternalLinkIcon, RotateCcwIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { data, Form, Link, useNavigation } from "react-router";
import invariant from "tiny-invariant";

import type { Route } from "./+types/admin.texts.$category";

import { AdminPageHeader } from "~/components/admin-ui";
import { ErrorList } from "~/components/forms";
import { BackLink, chipVariants } from "~/components/section";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import {
  requestLoggerContext,
  userContext,
} from "~/features/auth/middleware.server";
import {
  getSiteTextCategory,
  SITE_TEXT_CATEGORIES,
  SITE_TEXTS,
  siteTextKeysIn,
  type SiteTextKey,
} from "~/features/site-text/registry";
import { saveSiteTextCategory } from "~/features/site-text/save.server";
import { TextDocument } from "~/features/site-text/text-document";
import type { SiteTextEntry } from "~/features/site-text/types";
import { cn } from "~/lib/utils";
import { listSiteTexts } from "~/models/site-text.server";
import { requireFound } from "~/shared/http.server";
import { redirectWithToast } from "~/utils/toast.server";

function requireCategory(id: string | undefined) {
  return requireFound(id ? getSiteTextCategory(id) : undefined);
}

export async function loader({ params }: Route.LoaderArgs) {
  const category = requireCategory(params.category);
  const keys = new Set<string>(siteTextKeysIn(category.id));
  const rows = (await listSiteTexts()).filter((row) => keys.has(row.key));

  return {
    categoryId: category.id,
    edits: Object.fromEntries(
      rows.map((row) => [
        row.key,
        {
          value: row.value,
          defaultAtEdit: row.defaultAtEdit,
          updatedAt: row.updatedAt,
        },
      ]),
    ) as Partial<
      Record<
        SiteTextKey,
        { value: string; defaultAtEdit: string; updatedAt: Date }
      >
    >,
  };
}

export async function action({ request, params, context }: Route.ActionArgs) {
  const category = requireCategory(params.category);
  const logger = context.get(requestLoggerContext);
  const user = context.get(userContext);

  const result = await saveSiteTextCategory(
    category.id,
    await request.formData(),
  );

  if (!result.ok) {
    return data({ errors: result.errors }, { status: 400 });
  }

  logger.info(
    { category: category.id, keys: result.changedKeys, userId: user.id },
    "Site texts saved",
  );

  const count = result.changedKeys.length;
  return redirectWithToast(`/admin/texts/${category.id}`, {
    title:
      count === 0
        ? "Nothing to save"
        : `${count} ${count === 1 ? "text" : "texts"} saved`,
    description:
      count === 0 ? undefined : "Visitors see the new wording right away.",
    type: count === 0 ? "message" : "success",
  });
}

export const meta: Route.MetaFunction = ({ loaderData }) => {
  const category = loaderData
    ? getSiteTextCategory(loaderData.categoryId)
    : undefined;
  return [{ title: `Admin - Texts${category ? ` - ${category.label}` : ""}` }];
};

export default function AdminTextCategoryPage({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  const { categoryId, edits } = loaderData;
  const category = getSiteTextCategory(categoryId);
  invariant(category, `unknown text category ${categoryId}`);
  const keys = useMemo(() => siteTextKeysIn(categoryId), [categoryId]);

  // what the page holds when it loads: the admin's edit, else the default
  const saved = useMemo(
    () =>
      Object.fromEntries(
        keys.map((key) => [key, edits[key]?.value ?? SITE_TEXTS[key].default]),
      ) as Record<SiteTextKey, string>,
    [keys, edits],
  );

  const [values, setValues] = useState(saved);
  // a save reloads the page's data; start over from what is stored now
  useEffect(() => setValues(saved), [saved]);

  const navigation = useNavigation();
  const saving =
    navigation.state !== "idle" && navigation.formMethod === "POST";
  const dirtyCount = keys.filter((key) => values[key] !== saved[key]).length;
  const errors = actionData?.errors ?? {};

  // jump to a text linked from the search on the overview
  useEffect(() => {
    const id = decodeURIComponent(window.location.hash.slice(1));
    if (id) document.getElementById(id)?.scrollIntoView({ block: "center" });
  }, []);

  return (
    <div className="animate-page-in flex flex-col gap-5">
      <div>
        <BackLink to="/admin/texts" prefetch="intent">
          Texts
        </BackLink>
        <AdminPageHeader
          eyebrow={`${keys.length} texts`}
          title={category.label}
          subtitle={category.description}
          actions={
            "path" in category ? (
              <a
                href={category.path}
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-foreground inline-flex items-center gap-2 text-sm transition-colors"
              >
                View on the site
                <ExternalLinkIcon className="size-4" />
              </a>
            ) : undefined
          }
        />
      </div>

      <nav
        aria-label="Text sections"
        className="scrollbar-hidden -mt-2 flex gap-2 overflow-x-auto whitespace-nowrap"
      >
        {SITE_TEXT_CATEGORIES.map((other) => (
          <Link
            key={other.id}
            to={`/admin/texts/${other.id}`}
            prefetch="intent"
            aria-current={other.id === category.id ? "page" : undefined}
            className={chipVariants({ active: other.id === category.id })}
          >
            {other.label}
          </Link>
        ))}
      </nav>

      <Form method="post" className="flex flex-col gap-4">
        {keys.map((key) => (
          <TextField
            key={key}
            textKey={key}
            entry={SITE_TEXTS[key]}
            value={values[key]}
            savedValue={saved[key]}
            edit={edits[key]}
            error={errors[key]}
            onChange={(value) =>
              setValues((current) => ({ ...current, [key]: value }))
            }
          />
        ))}

        <div className="bg-background/90 sticky bottom-0 z-10 -mx-2 border-t px-4 py-3 backdrop-blur md:bottom-2 md:mx-0 md:border">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p
              className={cn(
                "text-muted-foreground order-last text-center text-sm sm:order-first sm:text-left",
                dirtyCount === 0 && Object.keys(errors).length === 0
                  ? "invisible"
                  : null,
              )}
            >
              {Object.keys(errors).length > 0
                ? "Some texts need fixing before anything is saved."
                : `${dirtyCount} unsaved ${dirtyCount === 1 ? "change" : "changes"}`}
            </p>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center">
              <Button
                type="button"
                variant="outline"
                disabled={dirtyCount === 0 || saving}
                onClick={() => setValues(saved)}
              >
                Discard changes
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Saving…" : "Save"}
              </Button>
            </div>
          </div>
        </div>
      </Form>
    </div>
  );
}

function TextField({
  textKey,
  entry,
  value,
  savedValue,
  edit,
  error,
  onChange,
}: {
  textKey: SiteTextKey;
  entry: SiteTextEntry;
  value: string;
  savedValue: string;
  edit: { value: string; defaultAtEdit: string; updatedAt: Date } | undefined;
  error: string | undefined;
  onChange: (value: string) => void;
}) {
  const kind = entry.kind ?? "line";
  const inputId = `text-${textKey}`;
  const errorId = error ? `${inputId}-error` : undefined;
  const isDefault = value === entry.default;
  const defaultChanged =
    edit !== undefined && edit.defaultAtEdit !== entry.default;
  const placeholders = Object.entries(entry.vars ?? {});
  const tags = Object.entries(entry.tags ?? {});

  return (
    <Card
      id={textKey}
      className={cn(
        "flex scroll-mt-24 flex-col gap-3 p-4 md:p-5",
        error && "border-destructive/50",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <Label htmlFor={inputId} className="text-sm font-semibold">
            {entry.label}
          </Label>
          {entry.hint ? (
            <p className="text-muted-foreground mt-1 text-sm">{entry.hint}</p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {value !== savedValue ? (
            <Badge variant="secondary" pill>
              unsaved
            </Badge>
          ) : null}
          {edit ? (
            <Badge variant="info" pill>
              edited
            </Badge>
          ) : null}
        </div>
      </div>

      {defaultChanged ? (
        <div className="border-primary/35 bg-primary/10 flex flex-col gap-1 border p-3 text-sm">
          <p className="font-semibold">
            The built-in text changed since this was edited
          </p>
          <p className="text-muted-foreground">
            The new default reads:{" "}
            <span className="text-foreground whitespace-pre-line">
              {entry.default}
            </span>
          </p>
          <p className="text-muted-foreground">
            Reset to take it, or save to keep your version.
          </p>
        </div>
      ) : null}

      {kind === "line" ? (
        <Input
          id={inputId}
          name={textKey}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={errorId}
        />
      ) : (
        <Textarea
          id={inputId}
          name={textKey}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          rows={
            kind === "document"
              ? 24
              : Math.min(12, Math.max(3, value.split("\n").length + 1))
          }
          className={kind === "document" ? "font-mono text-sm" : undefined}
          aria-invalid={error ? true : undefined}
          aria-describedby={errorId}
        />
      )}

      {errorId ? <ErrorList id={errorId} errors={[error]} /> : null}

      {placeholders.length > 0 || tags.length > 0 ? (
        <ul className="text-muted-foreground flex flex-col gap-1 text-sm">
          {placeholders.map(([name, meaning]) => (
            <li key={name}>
              <code className="bg-muted rounded px-1">{`{${name}}`}</code>{" "}
              {meaning}
            </li>
          ))}
          {tags.map(([name, meaning]) => (
            <li key={name}>
              <code className="bg-muted rounded px-1">{`<${name}>…</${name}>`}</code>{" "}
              {meaning}
            </li>
          ))}
        </ul>
      ) : null}

      {kind === "document" ? (
        <details className="border-t pt-3">
          <summary className="cursor-pointer text-sm font-semibold">
            Preview
          </summary>
          <div className="mt-4">
            <TextDocument source={value} />
          </div>
        </details>
      ) : null}

      <div className="text-muted-foreground flex flex-wrap items-center justify-between gap-2 text-xs">
        <code>{textKey}</code>
        {!isDefault ? (
          <button
            type="button"
            onClick={() => onChange(entry.default)}
            className="text-primary inline-flex items-center gap-1 text-sm font-semibold hover:underline"
          >
            <RotateCcwIcon className="size-3.5" />
            Reset to default
          </button>
        ) : null}
      </div>

      {!isDefault && kind !== "document" ? (
        <p className="text-muted-foreground text-xs">
          Default: <span className="whitespace-pre-line">{entry.default}</span>
        </p>
      ) : null}
    </Card>
  );
}
