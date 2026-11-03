import { ChevronRightIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router";

import type { Route } from "./+types/admin.texts._index";

import { AdminPageHeader, AdminSearchField } from "~/components/admin-ui";
import { Badge } from "~/components/ui/badge";
import { Card } from "~/components/ui/card";
import {
  categoryOf,
  isSiteTextKey,
  SITE_TEXT_CATEGORIES,
  SITE_TEXTS,
  type SiteTextKey,
} from "~/features/site-text/registry";
import { listSiteTexts } from "~/models/site-text.server";

export async function loader() {
  const rows = await listSiteTexts();
  return {
    edits: rows.flatMap(({ key, value, defaultAtEdit }) =>
      isSiteTextKey(key)
        ? [
            {
              key,
              value,
              defaultChanged: defaultAtEdit !== SITE_TEXTS[key].default,
            },
          ]
        : [],
    ),
  };
}

export const meta: Route.MetaFunction = () => [{ title: "Admin - Texts" }];

const ALL_KEYS = Object.keys(SITE_TEXTS) as SiteTextKey[];

/** Lower-cased, accent-free, so "zurich" finds "zürich". */
function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

export default function AdminTextsPage({ loaderData }: Route.ComponentProps) {
  const { edits } = loaderData;
  const [query, setQuery] = useState("");

  const editsByKey = useMemo(
    () => new Map(edits.map((edit) => [edit.key, edit])),
    [edits],
  );

  const matches = useMemo(() => {
    const needle = normalize(query.trim());
    if (!needle) return [];
    return ALL_KEYS.filter((key) => {
      const entry = SITE_TEXTS[key];
      const current = editsByKey.get(key)?.value ?? entry.default;
      return [key, entry.label, entry.default, current].some((haystack) =>
        normalize(haystack).includes(needle),
      );
    });
  }, [query, editsByKey]);

  const editedCount = edits.length;

  return (
    <div className="animate-page-in">
      <AdminPageHeader
        eyebrow={`${ALL_KEYS.length} texts · ${editedCount} edited`}
        title="Texts"
        subtitle="Every word visitors read on the site and in its emails. Pick a section, or search for a sentence you've seen."
        actions={
          <AdminSearchField
            value={query}
            onChange={setQuery}
            placeholder="Search all texts…"
          />
        }
      />

      {query.trim() ? (
        <SearchResults
          keys={matches}
          editedKeys={new Set(editsByKey.keys())}
          currentValue={(key) =>
            editsByKey.get(key)?.value ?? SITE_TEXTS[key].default
          }
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {SITE_TEXT_CATEGORIES.map((category) => {
            const keys = ALL_KEYS.filter(
              (key) => categoryOf(key) === category.id,
            );
            const edited = keys.filter((key) => editsByKey.has(key)).length;
            const stale = keys.filter(
              (key) => editsByKey.get(key)?.defaultChanged,
            ).length;

            return (
              <Link
                key={category.id}
                to={category.id}
                prefetch="intent"
                className="group"
              >
                <Card className="group-hover:border-foreground/30 flex h-full items-center gap-4 p-4 transition-colors md:p-5">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-base font-semibold">
                        {category.label}
                      </h2>
                      {edited > 0 ? (
                        <Badge variant="info" pill>
                          {edited} edited
                        </Badge>
                      ) : null}
                      {stale > 0 ? (
                        <Badge variant="secondary" pill>
                          {stale} to review
                        </Badge>
                      ) : null}
                    </div>
                    <p className="text-muted-foreground mt-1 text-sm">
                      {category.description}
                    </p>
                    <p className="text-muted-foreground mt-2 text-xs">
                      {keys.length} {keys.length === 1 ? "text" : "texts"}
                    </p>
                  </div>
                  <ChevronRightIcon className="text-muted-foreground size-5 shrink-0" />
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function SearchResults({
  keys,
  editedKeys,
  currentValue,
}: {
  keys: SiteTextKey[];
  editedKeys: Set<SiteTextKey>;
  currentValue: (key: SiteTextKey) => string;
}) {
  if (keys.length === 0) {
    return (
      <Card className="p-6 text-center">
        <p className="font-semibold">No text matches</p>
        <p className="text-muted-foreground mt-1 text-sm">
          Try fewer words. Texts that show a name or a number search by the
          words around it.
        </p>
      </Card>
    );
  }

  return (
    <Card className="divide-y">
      {keys.slice(0, 100).map((key) => {
        const category = SITE_TEXT_CATEGORIES.find(
          (candidate) => candidate.id === categoryOf(key),
        );
        const value = currentValue(key);

        return (
          <Link
            key={key}
            to={`${categoryOf(key)}#${encodeURIComponent(key)}`}
            className="hover:bg-foreground/5 flex flex-col gap-1 px-4 py-3 transition-colors md:px-5"
          >
            <span className="flex flex-wrap items-center gap-2 text-sm">
              <span className="font-semibold">{SITE_TEXTS[key].label}</span>
              <span className="text-muted-foreground">· {category?.label}</span>
              {editedKeys.has(key) ? (
                <Badge variant="info" pill>
                  edited
                </Badge>
              ) : null}
            </span>
            <span className="text-muted-foreground line-clamp-2 text-sm">
              {value || "(blank)"}
            </span>
          </Link>
        );
      })}
      {keys.length > 100 ? (
        <p className="text-muted-foreground px-4 py-3 text-sm md:px-5">
          {keys.length - 100} more — narrow the search to see them.
        </p>
      ) : null}
    </Card>
  );
}
