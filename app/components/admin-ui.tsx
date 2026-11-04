import { SearchIcon } from "lucide-react";

import { chipVariants, Eyebrow, pageTitleClassName } from "./section";
import { Card } from "./ui/card";
import { fieldShellClassName } from "./ui/input";

import { cn } from "~/lib/utils";

export function AdminPageHeader({
  eyebrow,
  title,
  subtitle,
  actions,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <Eyebrow variant="tracked" tone="label" className="mb-2">
          {eyebrow}
        </Eyebrow>
        <h1 className={pageTitleClassName}>{title}</h1>
        {subtitle ? (
          <p className="text-muted-foreground mt-2 text-base">{subtitle}</p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex flex-wrap items-center gap-2">{actions}</div>
      ) : null}
    </div>
  );
}

export function AdminSearchField({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <div
      className={cn(
        fieldShellClassName,
        "flex items-center gap-2 max-md:w-full md:w-72",
      )}
    >
      <SearchIcon className="text-muted-foreground size-4 shrink-0" />
      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="placeholder:text-muted-foreground min-w-0 flex-1 bg-transparent text-sm outline-none"
      />
    </div>
  );
}

export function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={chipVariants({ active })}
    >
      {children}
    </button>
  );
}

export function SeatProgress({
  taken,
  total,
  muted = false,
}: {
  taken: number;
  total: number;
  muted?: boolean;
}) {
  const percent =
    total > 0 ? Math.min(100, Math.round((taken / total) * 100)) : 0;

  return (
    <div className="bg-foreground/10 h-2 flex-1 overflow-hidden">
      <div
        className={cn(
          "h-full transition-[width] duration-500",
          muted ? "bg-foreground/40" : "bg-primary",
        )}
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}

const AVATAR_TINTS = [
  "text-accent-light bg-primary/10",
  "text-foreground/80 bg-foreground/10",
];

function avatarInitials(name: string) {
  const parts = name.trim().split(/\s+/);
  return (
    (parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? parts[0]?.[1] ?? "")
  ).toUpperCase();
}

export function InitialsAvatar({
  name,
  seed,
  className,
}: {
  name: string;
  seed: number;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex size-10 shrink-0 items-center justify-center text-sm font-semibold",
        AVATAR_TINTS[seed % AVATAR_TINTS.length],
        className,
      )}
    >
      {avatarInitials(name)}
    </span>
  );
}

export function AdminEmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <Card className="flex flex-col items-center gap-3 border-dashed px-6 py-14 text-center">
      <div className="bg-primary/10 text-primary mb-1 flex size-14 items-center justify-center">
        {icon}
      </div>
      <p className="text-lg font-semibold">{title}</p>
      <p className="text-muted-foreground max-w-xs text-sm">{description}</p>
      {action ? <div className="mt-1">{action}</div> : null}
    </Card>
  );
}
