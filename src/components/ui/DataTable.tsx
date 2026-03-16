import { Table } from "@/ui";
import * as React from "react";

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export function DataTable({
  className,
  ...props
}: React.TableHTMLAttributes<HTMLTableElement>) {
  return (
    <div className="w-full overflow-x-auto">
      <Table
        className={cx(
          "w-full border-collapse text-[13px]",
          "text-[color:var(--rg-text)]",
          className
        )}
        {...props}
      />
    </div>
  );
}

export function TH({
  className,
  ...props
}: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={cx(
        "text-left text-[11px] uppercase tracking-wide font-semibold",
        "text-[color:var(--rg-muted)]",
        "px-3 py-3 border-b border-[color:var(--rg-border-strong)]",
        className
      )}
      {...props}
    />
  );
}

export function TD({
  className,
  ...props
}: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td
      className={cx(
        "px-3 py-3 border-b border-[color:var(--rg-border-strong)]",
        className
      )}
      {...props}
    />
  );
}

export function TR({
  className,
  ...props
}: React.HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr
      className={cx(
        "hover:bg-[color:var(--rg-panel-2)] transition",
        className
      )}
      {...props}
    />
  );
}
