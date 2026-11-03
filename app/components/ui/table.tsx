import type { ClassValue } from "clsx";
import React from "react";

import { cn } from "~/lib/utils";

type ElementProps<T> = {
  className?: string | ClassValue[];
  ref?: React.Ref<T>;
};

const Table = ({
  className,
  ref,
  ...props
}: React.TableHTMLAttributes<HTMLTableElement> &
  ElementProps<HTMLTableElement>) => (
  <div className="relative w-full overflow-auto">
    <table
      ref={ref}
      className={cn("w-full caption-bottom text-sm", className)}
      {...props}
    />
  </div>
);

Table.displayName = "Table";

const TableHeader = ({
  className,
  ref,
  ...props
}: React.HTMLAttributes<HTMLTableSectionElement> &
  ElementProps<HTMLTableSectionElement>) => (
  <thead ref={ref} className={cn("[&_tr]:border-b", className)} {...props} />
);

TableHeader.displayName = "TableHeader";

const TableBody = ({
  className,
  ref,
  ...props
}: React.HTMLAttributes<HTMLTableSectionElement> &
  ElementProps<HTMLTableSectionElement>) => (
  <tbody
    ref={ref}
    className={cn("[&_tr:last-child]:border-0", className)}
    {...props}
  />
);

TableBody.displayName = "TableBody";

const TableRow = ({
  className,
  ref,
  ...props
}: React.HtmlHTMLAttributes<HTMLTableRowElement> &
  ElementProps<HTMLTableRowElement>) => (
  <tr
    ref={ref}
    className={cn(
      "hover:bg-foreground/5 border-b transition-colors",
      className,
    )}
    {...props}
  />
);

TableRow.displayName = "TableRow";

const TableHead = ({
  className,
  ref,
  ...props
}: React.ThHTMLAttributes<HTMLTableCellElement> &
  ElementProps<HTMLTableCellElement>) => (
  <th
    ref={ref}
    className={cn(
      "text-muted-foreground px-4 py-3 text-left align-middle text-xs font-semibold tracking-widest uppercase",
      className,
    )}
    {...props}
  />
);

TableHead.displayName = "TableHead";

const TableCell = ({
  className,
  ref,
  ...props
}: React.TdHTMLAttributes<HTMLTableCellElement> &
  ElementProps<HTMLTableCellElement>) => (
  <td
    ref={ref}
    className={cn("px-4 py-4 align-middle", className)}
    {...props}
  />
);

TableCell.displayName = "TableCell";

export { Table, TableBody, TableCell, TableHead, TableHeader, TableRow };
