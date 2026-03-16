"use client";

import { Button, NativeSelect } from "@/ui";
import type { IntakeDraft } from "../types";

const CHANGE_TYPES: { value: string; label: string; description?: string }[] = [
  { value: "PRICING_CHANGE", label: "Pricing change", description: "Changes to pricing tiers, discounts, or rate plans." },
  { value: "BILLING_LOGIC_CHANGE", label: "Billing configuration", description: "How customers are billed (invoicing, cycles, rules)." },
  { value: "PAYMENT_FLOW_CHANGE", label: "Payment flow", description: "How payments are collected or processed." },
  { value: "SUBSCRIPTION_LIFECYCLE_CHANGE", label: "Contract terms", description: "Subscription start, renewal, cancellation, or terms." },
  { value: "REVENUE_RECOGNITION_CHANGE", label: "Revenue recognition rules", description: "When and how revenue is recognized." },
  { value: "INTEGRATION_CHANGE", label: "System configuration", description: "Integrations or system settings that affect revenue." },
  { value: "PROMOTION_DISCOUNT_CHANGE", label: "Promotion or discount" },
  { value: "TAX_CHANGE", label: "Tax" },
  { value: "ENTITLEMENTS_CHANGE", label: "Entitlements" },
  { value: "REPORTING_CHANGE", label: "Reporting" },
  { value: "DATA_BACKFILL", label: "Data backfill" },
  { value: "OTHER", label: "Other" },
];

const DOMAINS = [
  { value: "REVENUE", label: "Revenue" },
  { value: "DATA", label: "Data" },
  { value: "WORKFLOW", label: "Workflow" },
  { value: "SECURITY", label: "Security" },
];

export function ChangeTypeStep(props: {
  draft: IntakeDraft;
  onDraftChange: (next: Partial<IntakeDraft>) => void;
  onSave: () => Promise<void>;
  saving: boolean;
}) {
  const { draft, onDraftChange, onSave, saving } = props;
  const changeType = draft.structured_change_type ?? draft.change_type ?? "";
  const domain = draft.domain ?? "REVENUE";

  const selectedMeta = CHANGE_TYPES.find((t) => t.value === changeType);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-[var(--text)]">What kind of change are you making?</h2>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Choose the option that best matches your change. This helps us suggest the right impact level and approvers.
        </p>
      </div>

      <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-muted)]/50 p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">Why we ask</p>
        <p className="mt-1 text-sm text-[var(--text)]">
          Different change types have different approval and evidence requirements. Picking the right one keeps the process smooth.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <label className="text-sm font-medium text-[var(--text)]">Change type</label>
          <NativeSelect
            className="rounded-lg border px-3 py-2 w-full"
            value={changeType}
            onChange={(e) =>
              onDraftChange({
                change_type: e.target.value || "OTHER",
                structured_change_type: e.target.value || null,
              })
            }
          >
            <option value="">Select…</option>
            {CHANGE_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </NativeSelect>
          {selectedMeta?.description && (
            <p className="text-xs text-[var(--text-muted)]">{selectedMeta.description}</p>
          )}
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-[var(--text)]">Risk area</label>
          <NativeSelect
            className="rounded-lg border px-3 py-2"
            value={domain}
            onChange={(e) =>
              onDraftChange({ domain: e.target.value || "REVENUE" })
            }
          >
            {DOMAINS.map((d) => (
              <option key={d.value} value={d.value}>
                {d.label}
              </option>
            ))}
          </NativeSelect>
        </div>
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
