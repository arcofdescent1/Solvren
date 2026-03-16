"use client";

import LinkIncidentButton from "@/components/incidents/LinkIncidentButton";
import SubmitForReviewButton from "@/components/SubmitForReviewButton";
import RunSlaTickButton from "@/components/RunSlaTickButton";
import { useReadyStatus } from "@/components/ChangeReadyContext";

export default function ChangeActionsColumn({
  changeEventId,
  orgId,
  status,
  onIncidentCreated,
}: {
  changeEventId: string;
  orgId: string;
  status: string;
  onIncidentCreated?: () => void;
}) {
  const { ready, loading } = useReadyStatus();
  const disabledSubmit = loading || !ready;

  return (
    <div className="flex items-center gap-2">
      <LinkIncidentButton
        changeEventId={changeEventId}
        orgId={orgId}
        onCreated={onIncidentCreated ?? (() => {})}
      />
      <SubmitForReviewButton
        changeEventId={changeEventId}
        status={status}
        disabled={disabledSubmit}
      />
      <RunSlaTickButton />
    </div>
  );
}
