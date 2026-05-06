"use client";

import Link from "next/link";
import { Button } from "@/ui";

export type NextActionIssueLike = {
  id: string;
  approval_state?: string | null;
  owner_user_id?: string | null;
  status?: string | null;
};

/**
 * Phase 5 — single primary CTA from precedence: approve → assign → resolve → acknowledge (detected only).
 */
export function NextActionBanner({
  issue,
  className = "",
}: {
  issue: NextActionIssueLike;
  className?: string;
}) {
  const st = String(issue.status ?? "");
  const ap = String(issue.approval_state ?? "not_required");
  const hasOwner = Boolean(issue.owner_user_id);

  if (ap === "pending") {
    return (
      <div className={`flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3 ${className}`}>
        <p className="text-sm font-medium">Approval pending for this issue.</p>
        <Link href={`/issues/${issue.id}`}>
          <Button variant="default" size="sm">
            Approve
          </Button>
        </Link>
      </div>
    );
  }

  if (!hasOwner && st !== "resolved" && st !== "verified" && st !== "dismissed") {
    return (
      <div className={`flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3 ${className}`}>
        <p className="text-sm font-medium">Assign an owner to move this forward.</p>
        <Link href={`/issues/${issue.id}`}>
          <Button variant="default" size="sm">
            Assign owner
          </Button>
        </Link>
      </div>
    );
  }

  if (st === "in_progress") {
    return (
      <div className={`flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3 ${className}`}>
        <p className="text-sm font-medium">Mark resolved when the fix is live.</p>
        <Link href={`/issues/${issue.id}`}>
          <Button variant="default" size="sm">
            Resolve
          </Button>
        </Link>
      </div>
    );
  }

  if (st === "detected") {
    return (
      <div className={`flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3 ${className}`}>
        <p className="text-sm font-medium">Acknowledge to show you&apos;re on it.</p>
        <Link href={`/issues/${issue.id}`}>
          <Button variant="default" size="sm">
            Acknowledge
          </Button>
        </Link>
      </div>
    );
  }

  return null;
}
