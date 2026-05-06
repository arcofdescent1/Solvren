"use client";

import type { Issue } from "@/modules/issues";
import { NextActionBanner } from "./NextActionBanner";

/** Issue row may include DB-only columns not on the domain Issue type. */
export function IssueDetailNextAction({
  issue,
}: {
  issue: Issue & { approval_state?: string | null };
}) {
  return (
    <NextActionBanner
      issue={{
        id: issue.id,
        status: issue.status,
        owner_user_id: issue.owner_user_id,
        approval_state: issue.approval_state,
      }}
    />
  );
}
