"use client";

import { Button, Input } from "@/ui";
import type { IntakeDraft } from "../types";

const ROLLOUT_METHODS = [
  { value: "GRADUAL", label: "Gradual rollout" },
  { value: "IMMEDIATE", label: "Immediate release" },
];

export function RolloutStep(props: {
  draft: IntakeDraft;
  onDraftChange: (next: Partial<IntakeDraft>) => void;
  onSave: () => Promise<void>;
  saving: boolean;
}) {
  const { draft, onDraftChange, onSave, saving } = props;
  const rollout = draft.rollout_method ?? "";
  const planned = draft.planned_release_at ?? "";
  const rollbackHours = draft.rollback_time_estimate_hours ?? null;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Rollout strategy</h2>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Define execution safety. Operational maturity shows up here.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-1.5">
          <span className="text-sm font-medium">Rollout type</span>
          <select
            className="rounded-lg border border-[var(--border)] bg-[var(--input-bg)] px-3 py-2 text-sm"
            value={rollout}
            onChange={(e) =>
              onDraftChange({ rollout_method: e.target.value || null })
            }
          >
            <option value="">Select…</option>
            {ROLLOUT_METHODS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </label>

        <label className="grid gap-1.5">
          <span className="text-sm font-medium">Planned release date</span>
          <Input
            type="datetime-local"
            className="rounded-lg border px-3 py-2"
            value={
              planned
                ? new Date(planned).toISOString().slice(0, 16)
                : ""
            }
            onChange={(e) =>
              onDraftChange({
                planned_release_at: e.target.value
                  ? new Date(e.target.value).toISOString()
                  : null,
                requested_release_at: e.target.value
                  ? new Date(e.target.value).toISOString()
                  : null,
              })
            }
          />
        </label>

        <label className="grid gap-1.5">
          <span className="text-sm font-medium">
            Rollback time estimate (hours)
          </span>
          <Input
            type="number"
            min={0}
            className="rounded-lg border px-3 py-2"
            placeholder="e.g. 1"
            value={rollbackHours != null ? String(rollbackHours) : ""}
            onChange={(e) => {
              const v = e.target.value.trim();
              onDraftChange({
                rollback_time_estimate_hours:
                  v === "" ? null : Math.max(0, Number(v) || 0),
              });
            }}
          />
          <p className="text-xs text-[var(--text-muted)]">Recommended</p>
        </label>
      </div>

      <div className="flex justify-between pt-4">
        <div />
        <Button onClick={onSave} disabled={saving}>
          {saving ? "Saving…" : "Save & Continue"}
        </Button>
      </div>
    </div>
  );
}
