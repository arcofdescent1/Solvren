import * as React from "react";

export type EmptyStateVariant =
  | "good_empty"
  | "filtered_empty"
  | "incomplete_setup"
  | "still_building";

type EmptyStateProps = {
  variant: EmptyStateVariant;
  title: React.ReactNode;
  body: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
};

export function EmptyState({ variant, title, body, action, className }: EmptyStateProps) {
  const tone =
    variant === "incomplete_setup"
      ? "border-[var(--warning)]/40 bg-[color:color-mix(in_oklab,var(--warning)_8%,var(--bg-surface))]"
      : "border-[var(--border)] bg-[var(--bg-surface)]";
  return (
    <div className={`rounded-[var(--radius-md)] border p-6 text-center ${tone} ${className ?? ""}`}>
      <p className="font-medium text-[var(--text)]">{title}</p>
      <p className="mt-1 text-sm text-[var(--text-muted)]">{body}</p>
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}
