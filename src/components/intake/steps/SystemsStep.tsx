"use client";

import { Button } from "@/ui";
import type { IntakeDraft } from "../types";

const SYSTEMS = [
  "HubSpot",
  "Salesforce",
  "Stripe",
  "Chargebee",
  "Shopify",
  "NetSuite",
  "Snowflake",
  "Looker",
  "Segment",
  "Zapier",
  "Make",
  "Other",
];

function toggleInArray(arr: string[], value: string) {
  return arr.includes(value) ? arr.filter((x) => x !== value) : [...arr, value];
}

export function SystemsStep(props: {
  draft: IntakeDraft;
  onDraftChange: (next: Partial<IntakeDraft>) => void;
  onSave: () => Promise<void>;
  saving: boolean;
}) {
  const { draft, onDraftChange, onSave, saving } = props;
  const systems = draft.systems_involved ?? [];
  const hint = systems.length === 0 ? "Select at least one system" : null;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-[var(--text)]">Where is this change happening?</h2>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Select the system or systems this change affects. If you have a Jira issue, you can link it on the change page after creation.
        </p>
      </div>

      <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-muted)]/50 p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">Why we ask</p>
        <p className="mt-1 text-sm text-[var(--text)]">
          Knowing where the change lives helps us route it to the right approvers and suggest the right evidence (e.g. Jira, Salesforce, NetSuite).
        </p>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-[var(--text)]">Systems involved</label>
        <div className="flex flex-wrap gap-2">
          {SYSTEMS.map((s) => {
            const selected = systems.includes(s);
            return (
              <Button
                key={s}
                type="button"
                variant={selected ? "default" : "outline"}
                className="rounded-full px-4 py-2 text-sm"
                onClick={() =>
                  onDraftChange({
                    systems_involved: toggleInArray(systems, s),
                  })
                }
              >
                {s}
              </Button>
            );
          })}
        </div>
        {hint && (
          <p className="text-xs text-amber-600 dark:text-amber-400">{hint}</p>
        )}
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
