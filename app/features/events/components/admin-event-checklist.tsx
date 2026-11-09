import { ListChecksIcon, PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useFetcher } from "react-router";

import {
  CHECKLIST_CATEGORIES,
  type ChecklistCategory,
  groupChecklistByCategory,
  MAX_CHECKLIST_LABEL_LENGTH,
} from "../checklist";

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
  category: ChecklistCategory;
  done: boolean;
}

const ADD_PLACEHOLDERS: Record<ChecklistCategory, string> = {
  general: "e.g. send the guest list round",
  logistics: "e.g. borrow extra chairs",
  decorations: "e.g. buy candles and flowers",
  socials: "e.g. post a story on the night",
  menu: "e.g. test the dessert",
};

/**
 * The organisers' to-do list for one dinner, split by category. Anyone who
 * can open the admin area (moderators and admins) can tick, add, reword, move
 * and remove items. It posts to the event page's action with `checklist-*`
 * intents and is never shown publicly.
 */
export function AdminEventChecklist({
  items,
}: {
  items: ChecklistItemModel[];
}) {
  const doneCount = items.filter((item) => item.done).length;
  const groups = groupChecklistByCategory(items);

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
          The things this dinner needs that are easy to forget. Everyone on the
          team can tick, add, edit and remove items; the public never sees this
          list.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        {items.length === 0 ? <AddDefaultItems /> : null}

        <div className="grid gap-x-8 gap-y-6 md:grid-cols-2">
          {groups.map((group) => (
            <ChecklistSection
              key={group.category}
              category={group.category}
              label={group.label}
              items={group.items}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function ChecklistSection({
  category,
  label,
  items,
}: {
  category: ChecklistCategory;
  label: string;
  items: ChecklistItemModel[];
}) {
  const headingId = `checklist-${category}`;
  const doneCount = items.filter((item) => item.done).length;

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-2">
      <h3
        id={headingId}
        className="flex items-baseline justify-between gap-2 border-b pb-1.5 text-sm font-semibold tracking-wide uppercase"
      >
        {label}
        {items.length > 0 ? (
          <span className="text-muted-foreground text-xs font-normal tracking-normal normal-case">
            {doneCount} / {items.length} done
          </span>
        ) : null}
      </h3>

      {items.length > 0 ? (
        <ul className="flex flex-col divide-y">
          {items.map((item) => (
            <ChecklistRow key={item.id} item={item} />
          ))}
        </ul>
      ) : (
        <p className="text-muted-foreground py-1 text-sm">Nothing here yet.</p>
      )}

      <AddItemForm category={category} categoryLabel={label} />
    </section>
  );
}

function ChecklistRow({ item }: { item: ChecklistItemModel }) {
  const toggle = useFetcher();
  const remove = useFetcher();
  const save = useFetcher();
  const [editing, setEditing] = useState(false);
  const editButtonRef = useRef<HTMLButtonElement>(null);
  const refocusEditButton = useRef(false);

  // back on the pencil once the editor closes, so the keyboard isn't lost
  useEffect(() => {
    if (!editing && refocusEditButton.current) {
      refocusEditButton.current = false;
      editButtonRef.current?.focus();
    }
  }, [editing]);

  function closeEditor() {
    refocusEditButton.current = true;
    setEditing(false);
  }

  // the tick is a native checkbox, so a click shows at once; it is remounted
  // from the saved value once the page has reloaded its data. While a save
  // is in flight the row follows what was sent.
  const done = toggle.formData
    ? toggle.formData.get("done") === "true"
    : item.done;
  const savingLabel = save.formData?.get("label");
  const savingCategory = save.formData?.get("category");
  const label =
    typeof savingLabel === "string"
      ? savingLabel.trim().replace(/\s+/g, " ")
      : item.label;
  const removing = remove.state !== "idle";
  // a move shows up in the other category once the page has reloaded
  const moving =
    typeof savingCategory === "string" && savingCategory !== item.category;

  if (removing || moving) return null;

  if (editing) {
    return (
      <li className="py-2">
        <ChecklistItemEditor item={item} fetcher={save} onClose={closeEditor} />
      </li>
    );
  }

  return (
    <li className="flex items-center gap-2 py-2">
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
            {label}
          </span>
        </label>
      </toggle.Form>
      <Button
        ref={editButtonRef}
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label={`Edit “${label}”`}
        onClick={() => setEditing(true)}
      >
        <PencilIcon className="size-4" />
      </Button>
      <remove.Form method="post">
        <input type="hidden" name="intent" value="checklist-delete" />
        <input type="hidden" name="itemId" value={item.id} />
        <Button
          type="submit"
          variant="ghost"
          size="icon-sm"
          aria-label={`Remove “${label}”`}
        >
          <Trash2Icon className="size-4" />
        </Button>
      </remove.Form>
    </li>
  );
}

/** Rewords an item or moves it to another category. */
function ChecklistItemEditor({
  item,
  fetcher,
  onClose,
}: {
  item: ChecklistItemModel;
  fetcher: ReturnType<typeof useFetcher>;
  onClose: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  return (
    <fetcher.Form
      method="post"
      // the row shows what was sent while it saves, so the editor can go
      onSubmit={onClose}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          onClose();
        }
      }}
      className="flex flex-col gap-2"
    >
      <input type="hidden" name="intent" value="checklist-update" />
      <input type="hidden" name="itemId" value={item.id} />
      <Input
        ref={inputRef}
        name="label"
        aria-label="Item"
        defaultValue={item.label}
        required
        maxLength={MAX_CHECKLIST_LABEL_LENGTH}
        autoComplete="off"
        className="h-9"
      />
      <div className="flex flex-wrap items-center gap-2">
        <select
          name="category"
          aria-label="Category"
          defaultValue={item.category}
          className="bg-background focus-visible:inset-ring-ring h-9 border px-2 text-sm focus-visible:inset-ring-2 focus-visible:outline-hidden"
        >
          {CHECKLIST_CATEGORIES.map((category) => (
            <option key={category.value} value={category.value}>
              {category.label}
            </option>
          ))}
        </select>
        <Button type="submit" size="sm">
          Save
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </fetcher.Form>
  );
}

function AddDefaultItems() {
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

function AddItemForm({
  category,
  categoryLabel,
}: {
  category: ChecklistCategory;
  categoryLabel: string;
}) {
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
      <input type="hidden" name="category" value={category} />
      <Input
        name="label"
        aria-label={`New ${categoryLabel.toLowerCase()} item`}
        placeholder={ADD_PLACEHOLDERS[category]}
        required
        maxLength={MAX_CHECKLIST_LABEL_LENGTH}
        autoComplete="off"
        className="h-9 grow text-sm"
      />
      <Button
        type="submit"
        variant="outline"
        size="sm"
        disabled={adding}
        aria-label={`Add to ${categoryLabel}`}
      >
        <PlusIcon className="size-4" />
        Add
      </Button>
    </fetcher.Form>
  );
}
