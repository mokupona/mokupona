import { ListChecksIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { useEffect, useRef } from "react";
import { useFetcher } from "react-router";

import { MAX_CHECKLIST_LABEL_LENGTH } from "../checklist";

import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { cn } from "~/lib/utils";

export interface ChecklistItemModel {
  id: string;
  label: string;
  done: boolean;
}

/**
 * The organisers' to-do list for one dinner. Admin-only: it posts to the
 * event page's action with `checklist-*` intents and is never shown publicly.
 */
export function AdminEventChecklist({
  items,
}: {
  items: ChecklistItemModel[];
}) {
  const doneCount = items.filter((item) => item.done).length;

  return (
    <Card id="checklist">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ListChecksIcon className="size-5" />
          Checklist
          {items.length > 0 ? (
            <span className="text-muted-foreground text-sm font-normal">
              {doneCount} / {items.length} done
            </span>
          ) : null}
        </CardTitle>
        <CardDescription>
          The things this dinner needs that are easy to forget. Only admins see
          this list.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {items.length > 0 ? (
          <ul className="flex flex-col divide-y">
            {items.map((item) => (
              <ChecklistRow key={item.id} item={item} />
            ))}
          </ul>
        ) : (
          <EmptyChecklist />
        )}

        <AddItemForm />
      </CardContent>
    </Card>
  );
}

function ChecklistRow({ item }: { item: ChecklistItemModel }) {
  const toggle = useFetcher();
  const remove = useFetcher();

  // the tick is a native checkbox, so a click shows at once; it is remounted
  // from the saved value once the page has reloaded its data. While the save
  // is in flight the label follows what was sent.
  const done = toggle.formData
    ? toggle.formData.get("done") === "true"
    : item.done;
  const removing = remove.state !== "idle";

  if (removing) return null;

  return (
    <li className="flex items-center gap-3 py-2">
      <toggle.Form method="post" className="flex min-w-0 grow">
        <input type="hidden" name="intent" value="checklist-toggle" />
        <input type="hidden" name="itemId" value={item.id} />
        <label className="flex min-w-0 grow cursor-pointer items-center gap-3">
          <input
            key={String(item.done)}
            type="checkbox"
            name="done"
            value="true"
            defaultChecked={item.done}
            onChange={(event) => event.currentTarget.form?.requestSubmit()}
            className="accent-primary size-4 shrink-0"
          />
          <span
            className={cn(
              "min-w-0 break-words",
              done && "text-muted-foreground line-through",
            )}
          >
            {item.label}
          </span>
        </label>
      </toggle.Form>
      <remove.Form method="post">
        <input type="hidden" name="intent" value="checklist-delete" />
        <input type="hidden" name="itemId" value={item.id} />
        <Button
          type="submit"
          variant="ghost"
          size="icon-sm"
          aria-label={`Remove “${item.label}”`}
        >
          <Trash2Icon className="size-4" />
        </Button>
      </remove.Form>
    </li>
  );
}

function EmptyChecklist() {
  const fetcher = useFetcher();

  return (
    <div className="text-muted-foreground flex flex-col items-start gap-2 text-sm">
      <p>Nothing on the list yet.</p>
      <fetcher.Form method="post">
        <input type="hidden" name="intent" value="checklist-defaults" />
        <Button
          type="submit"
          variant="outline"
          size="sm"
          disabled={fetcher.state !== "idle"}
        >
          Add the usual items
        </Button>
      </fetcher.Form>
    </div>
  );
}

function AddItemForm() {
  const fetcher = useFetcher();
  const formRef = useRef<HTMLFormElement>(null);
  const adding = fetcher.state !== "idle";

  // clear the field once the item is in, ready for the next one
  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data) formRef.current?.reset();
  }, [fetcher.state, fetcher.data]);

  return (
    <fetcher.Form ref={formRef} method="post" className="flex gap-2">
      <input type="hidden" name="intent" value="checklist-add" />
      <Input
        name="label"
        aria-label="New checklist item"
        placeholder="Add an item, e.g. book a photographer"
        required
        maxLength={MAX_CHECKLIST_LABEL_LENGTH}
        autoComplete="off"
        className="grow"
      />
      <Button type="submit" variant="outline" disabled={adding}>
        <PlusIcon className="size-4" />
        Add
      </Button>
    </fetcher.Form>
  );
}
