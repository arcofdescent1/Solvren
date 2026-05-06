"use client";

import { NextActionBanner } from "./NextActionBanner";

export function ActionQueueNextCell({
  id,
  status,
  approval_state,
  owner_user_id,
}: {
  id: string;
  status: string;
  approval_state: string | null;
  owner_user_id: string | null;
}) {
  return (
    <NextActionBanner
      className="max-w-xs p-2 [&_p]:text-xs"
      issue={{ id, status, approval_state, owner_user_id }}
    />
  );
}
