"use client";

import { Button, Input, NativeSelect } from "@/ui";
import { FieldWithTooltip } from "@/components/forms/FieldWithTooltip";
import type { IntakeDraft } from "../types";

const SURFACES = [
  "PRICING",
  "BILLING",
  "PAYMENTS",
  "SUBSCRIPTIONS",
  "ENTITLEMENTS",
  "CHECKOUT",
  "TAX",
  "PROMOTIONS",
  "INVOICING",
  "OTHER",
];

const IMPACT_OPTIONS = [
  "Pricing",
  "Billing logic",
  "MRR/ARR",
  "Reporting",
  "Discounts",
  "Trial",
  "Revenue recognition",
];

// V1 spec: Impact Estimate bands
const IMPACT_ESTIMATE_BANDS = [
  { value: "", label: "Select…" },
  { value: "5000", label: "< $10k" },
  { value: "55000", label: "$10k – $100k" },
  { value: "550000", label: "$100k – $1M" },
  { value: "1500000", label: "$1M+" },
];

function toggleInArray(arr: string[], value: string) {
  return arr.includes(value) ? arr.filter((x) => x !== value) : [...arr, value];
}

export function RevenueImpactStep(props: {
  draft: IntakeDraft;
  onDraftChange: (next: Partial<IntakeDraft>) => void;
  onSave: () => Promise<void>;
  saving: boolean;
}) {
  const { draft, onDraftChange, onSave, saving } = props;
  const domain = draft.domain ?? "REVENUE";
  const showRevenueFields = domain === "REVENUE";
  const revenueAreas = draft.revenue_impact_areas ?? [];
  const estimatedMrr = draft.estimated_mrr_affected ?? null;
  const pctAffected = draft.percent_customer_base_affected ?? null;
  const surface = draft.revenue_surface ?? "";
  const backfill = draft.backfill_required ?? false;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-[var(--text)]">Estimated revenue impact</h2>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          We use this to suggest the right approval chain. You can adjust the band if needed.
        </p>
      </div>

      <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-muted)]/50 p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">Why we ask</p>
        <p className="mt-1 text-sm text-[var(--text)]">
          Pricing and billing changes can directly affect customer billing and revenue reporting. The impact band drives who needs to approve.
        </p>
      </div>

      {showRevenueFields && (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-1.5">
              <span className="text-sm font-medium">Revenue surface</span>
              <NativeSelect
                className="rounded-lg border px-3 py-2"
                value={surface}
                onChange={(e) =>
                  onDraftChange({ revenue_surface: e.target.value || null })
                }
              >
                <option value="">Select…</option>
                {SURFACES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </NativeSelect>
            </label>

            <FieldWithTooltip
              label="Impact Estimate"
              tooltip="Estimate the potential revenue impact. This drives risk level and approval requirements. Use bands for quick selection."
              examples={["$50k pricing adjustment", "$300k contract change"]}
            >
              <NativeSelect
                className="rounded-lg border px-3 py-2"
                value={
                  IMPACT_ESTIMATE_BANDS.find(
                    (b) => b.value && Number(b.value) === estimatedMrr
                  )?.value ?? (estimatedMrr != null ? String(estimatedMrr) : "")
                }
                onChange={(e) => {
                  const v = e.target.value;
                  onDraftChange({
                    estimated_mrr_affected:
                      v === "" ? null : Math.max(0, Number(v) || 0),
                  });
                }}
              >
                {IMPACT_ESTIMATE_BANDS.map((b) => (
                  <option key={b.value || "empty"} value={b.value}>
                    {b.label}
                  </option>
                ))}
              </NativeSelect>
            </FieldWithTooltip>
            <label className="grid gap-1.5">
              <span className="text-sm font-medium">Estimated MRR affected ($)</span>
              <Input
                type="number"
                min={0}
                className="rounded-lg border px-3 py-2"
                placeholder="e.g. $50k pricing change across 200 subscriptions"
                value={estimatedMrr != null ? String(estimatedMrr) : ""}
                onChange={(e) => {
                  const v = e.target.value.trim();
                  onDraftChange({
                    estimated_mrr_affected:
                      v === "" ? null : Math.max(0, Number(v) || 0),
                  });
                }}
              />
            </label>

            <label className="grid gap-1.5 sm:col-span-2">
              <span className="text-sm font-medium">
                Percent customer base affected (0–100)
              </span>
              <Input
                type="number"
                min={0}
                max={100}
                className="rounded-lg border px-3 py-2"
                placeholder="0"
                value={pctAffected != null ? String(pctAffected) : ""}
                onChange={(e) => {
                  const v = e.target.value.trim();
                  onDraftChange({
                    percent_customer_base_affected:
                      v === ""
                        ? null
                        : Math.max(0, Math.min(100, Number(v) || 0)),
                  });
                }}
              />
            </label>
          </div>

          <div className="space-y-2">
            <div className="text-sm font-medium">Impact areas</div>
            <div className="flex flex-wrap gap-2">
              {IMPACT_OPTIONS.map((opt) => {
                const selected = revenueAreas.includes(opt);
                return (
                  <Button
                    key={opt}
                    type="button"
                    variant={selected ? "default" : "outline"}
                    className="rounded-full px-4 py-2 text-sm"
                    onClick={() =>
                      onDraftChange({
                        revenue_impact_areas: toggleInArray(revenueAreas, opt),
                      })
                    }
                  >
                    {opt}
                  </Button>
                );
              })}
            </div>
          </div>
        </>
      )}

      <label className="flex items-center justify-between rounded-lg border px-3 py-2">
        <span className="text-sm font-medium">Backfill required?</span>
        <Input
          type="checkbox"
          checked={backfill}
          onChange={(e) =>
            onDraftChange({ backfill_required: e.target.checked })
          }
        />
      </label>

      <div className="flex justify-between pt-4">
        <div />
        <Button onClick={onSave} disabled={saving}>
          {saving ? "Saving…" : "Save & Continue"}
        </Button>
      </div>
    </div>
  );
}
