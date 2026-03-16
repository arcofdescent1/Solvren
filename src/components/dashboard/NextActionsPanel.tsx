"use client";

import Link from "next/link";
import { Card, CardBody } from "@/ui";

export type NextActionItem = {
  id: string;
  label: string;
  href: string;
  count?: number;
  severity?: "info" | "warning" | "high";
};

export type NextActionsPanelProps = {
  actions: NextActionItem[];
};

export function NextActionsPanel({ actions }: NextActionsPanelProps) {
  if (actions.length === 0) {
    return (
      <Card>
        <CardBody>
          <h2 className="font-semibold text-lg">My next actions</h2>
          <p className="mt-2 text-sm text-[var(--text-muted)]">
            You are all set. Check back for new approvals or evidence tasks.
          </p>
          <Link href="/changes" className="mt-3 inline-block text-sm font-medium text-[var(--primary)] hover:underline">
            View revenue changes
          </Link>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card className="transition-shadow duration-200 hover:shadow-md">
      <CardBody>
        <h2 className="mb-4 font-semibold text-lg">My next actions</h2>
        <ul className="space-y-2">
          {actions.map((action) => (
            <li key={action.id}>
              <Link
                href={action.href}
                className={`flex items-center justify-between rounded-lg border px-4 py-3 text-sm font-medium transition-colors hover:bg-[var(--bg-surface-2)] ${
                  action.severity === "high"
                    ? "border-[var(--danger)]/40 bg-[color:color-mix(in_oklab,var(--danger)_6%,var(--bg-surface))]"
                    : action.severity === "warning"
                      ? "border-[var(--warning)]/40 bg-[color:color-mix(in_oklab,var(--warning)_6%,var(--bg-surface))]"
                      : "border-[var(--border)] bg-[var(--bg-surface)]"
                }`}
              >
                <span className="text-[var(--text)]">{action.label}</span>
                {action.count != null && action.count > 0 ? (
                  <span className="shrink-0 rounded-full bg-[var(--primary)]/20 px-2 py-0.5 text-xs font-semibold text-[var(--primary)]">
                    {action.count}
                  </span>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      </CardBody>
    </Card>
  );
}
