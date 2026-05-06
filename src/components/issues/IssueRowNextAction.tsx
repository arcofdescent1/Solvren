"use client";

import type { Issue } from "@/modules/issues";
import { NextActionBanner } from "./NextActionBanner";

export function IssueRowNextAction({
  issue,
}: {
  issue: Issue & { approval_state?: string | null };
}) {
  return (
    <NextActionBanner
      className="max-w-md p-2 [&_p]:text-xs"
      issue={{
        id: issue.id,
        status: issue.status,
        owner_user_id: issue.owner_user_id,
        approval_state: issue.approval_state,
      }}
    />
  );
}
