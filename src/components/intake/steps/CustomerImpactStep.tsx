"use client";

import { Button, Input } from "@/ui";
import type { IntakeDraft } from "../types";

const SEGMENTS = [
  "Enterprise customers only",
  "All active subscribers",
  "New leads only",
  "Trial users",
  "Annual plans",
  "Monthly plans",
  "No direct customer impact",
];

function toggleInArray(arr: string[], value: string) {
  return arr.includes(value) ? arr.filter((x) => x !== value) : [...arr, value];
}

export function CustomerImpactStep({
  draft,
  onDraftChange,
  onSave,
  saving,
}: {
  draft: IntakeDraft;
  onDraftChange: (next: Partial<IntakeDraft>) => void;
  onSave: () => Promise<void>;
  saving: boolean;
}) {
  const impactExpected = draft.customer_impact_expected ?? false;
  const segments = draft.affected_customer_segments ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Customer impact</h2>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Define user and customer consequences. Helps move beyond purely
          technical governance.
        </p>
      </div>

      <label className="flex items-center justify-between rounded-lg border px-3 py-2">
        <span className="text-sm font-medium">Customer impact expected?</span>
        <Input
          type="checkbox"
          checked={impactExpected}
          onChange={(e) =>
            onDraftChange({ customer_impact_expected: e.target.checked })
          }
        />
      </label>

      {impactExpected && (
        <div className="space-y-2">
          <div className="text-sm font-medium">
            Affected customer segments
          </div>
          <div className="flex flex-wrap gap-2">
            {SEGMENTS.map((s) => {
              const selected = segments.includes(s);
              return (
                <Button
                  key={s}
                  type="button"
                  variant={selected ? "default" : "outline"}
                  className="rounded-full px-4 py-2 text-sm"
                  onClick={() =>
                    onDraftChange({
                      affected_customer_segments: toggleInArray(segments, s),
                    })
                  }
                >
                  {s}
                </Button>
              );
            })}
          </div>
          <p className="text-xs text-[var(--text-muted)]">
            Or type custom segments below (comma-separated).
          </p>
          <Input
            className="rounded-lg border px-3 py-2"
            placeholder="e.g., Enterprise, Annual plans"
            value={segments
              .filter((x) => !SEGMENTS.includes(x))
              .join(", ")}
            onChange={(e) => {
              const custom = e.target.value
                .split(",")
                .map((x) => x.trim())
                .filter(Boolean);
              onDraftChange({
                affected_customer_segments: [
                  ...segments.filter((x) => SEGMENTS.includes(x)),
                  ...custom,
                ],
              });
            }}
          />
        </div>
      )}

      <div className="flex justify-between pt-4">
        <div />
        <Button onClick={onSave} disabled={saving}>
          {saving ? "Saving…" : "Save & Continue"}
        </Button>
      </div>
    </div>
  );
}
