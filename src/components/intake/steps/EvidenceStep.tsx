"use client";

import { Button } from "@/ui";
import Link from "next/link";
import type { IntakeDraft } from "../types";
import { CoordinationAutopilotCard } from "@/components/coordination/CoordinationAutopilotCard";

const EVIDENCE_KINDS = [
  "TEST_PLAN",
  "ROLLBACK",
  "RUNBOOK",
  "DASHBOARD",
  "COMMS_PLAN",
  "PR",
  "OTHER",
];

const EVIDENCE_LABELS: Record<string, string> = {
  TEST_PLAN: "Test plan",
  ROLLBACK: "Rollback plan",
  RUNBOOK: "Runbook / Release plan",
  DASHBOARD: "Validation dashboard",
  COMMS_PLAN: "Customer comms plan",
  PR: "PR / Change diff",
  OTHER: "Other",
};

export function EvidenceStep(props: {
  draft: IntakeDraft;
  onDraftChange: (next: Partial<IntakeDraft>) => void;
  onSave: () => Promise<void>;
  saving: boolean;
}) {
  const { onSave, saving } = props;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-[var(--text)]">Proof the change was tested</h2>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          We suggest evidence based on your change type. You can upload or link documents on the change page after you submit.
        </p>
      </div>

      <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-muted)]/50 p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">Why we ask for evidence</p>
        <p className="mt-1 text-sm text-[var(--text)]">
          Evidence ensures pricing or billing changes do not accidentally impact revenue. Test plans, rollback plans, and approval sign-offs keep everyone safe.
        </p>
      </div>

      <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] p-4">
        <p className="text-sm font-medium text-[var(--text)]">Evidence types (from governance)</p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-[var(--text-muted)]">
          {EVIDENCE_KINDS.map((k) => (
            <li key={k}>{EVIDENCE_LABELS[k] ?? k}</li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-[var(--text-muted)]">
          After you submit, you can add evidence items and link documents on the
          change detail page.
        </p>
      </div>

      <CoordinationAutopilotCard changeId={props.draft.id} compact autoGenerate />

      <div className="flex justify-between pt-4">
        <Link href={`/changes/${props.draft.id}`} className="text-sm text-[var(--primary)] hover:underline">
          View change to add evidence
        </Link>
        <Button onClick={onSave} disabled={saving}>
          {saving ? "Saving…" : "Save & Continue"}
        </Button>
      </div>
    </div>
  );
}
