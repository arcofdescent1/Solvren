"use client";;
import { Button, Input, NativeSelect } from "@/ui";

const CHANGE_TYPES = [
  "PRICING_CHANGE",
  "BILLING_LOGIC_CHANGE",
  "PAYMENT_FLOW_CHANGE",
  "SUBSCRIPTION_LIFECYCLE_CHANGE",
  "ENTITLEMENTS_CHANGE",
  "PROMOTION_DISCOUNT_CHANGE",
  "TAX_CHANGE",
  "REVENUE_RECOGNITION_CHANGE",
  "REPORTING_CHANGE",
  "LEAD_ROUTING_CHANGE",
  "DATA_BACKFILL",
  "INTEGRATION_CHANGE",
  "OTHER",
] as const;

const ROLLOUT_METHODS = ["GRADUAL", "IMMEDIATE"] as const;

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
  "Other",
] as const;

function toggleInArray(arr: string[], value: string) {
  return arr.includes(value) ? arr.filter((x) => x !== value) : [...arr, value];
}

export default function ChangeIntakeSection(props: {
  value: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
}) {
  const v = props.value;

  return (
    <div className="rounded-2xl border bg-white p-4">
      <div className="text-sm font-semibold">Revenue intake (required)</div>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <label className="grid gap-1">
          <div className="text-xs text-neutral-600">Change type</div>
          <NativeSelect
            className="rounded-xl border px-3 py-2"
            value={(v.change_type ?? v.structured_change_type ?? "") as string}
            onChange={(e) =>
              props.onChange({
                ...v,
                change_type: e.target.value || null,
                structured_change_type: e.target.value || null,
              })
            }
          >
            <option value="">Select…</option>
            {CHANGE_TYPES.map((t) => (
              <option key={t} value={t}>
                {t.replaceAll("_", " ")}
              </option>
            ))}
          </NativeSelect>
        </label>

        <label className="grid gap-1">
          <div className="text-xs text-neutral-600">Rollout method</div>
          <NativeSelect
            className="rounded-xl border px-3 py-2"
            value={(v.rollout_method ?? "") as string}
            onChange={(e) =>
              props.onChange({ ...v, rollout_method: e.target.value || null })
            }
          >
            <option value="">Select…</option>
            {ROLLOUT_METHODS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </NativeSelect>
        </label>

        <label className="grid gap-1">
          <div className="text-xs text-neutral-600">Planned release date</div>
          <Input
            type="datetime-local"
            className="rounded-xl border px-3 py-2"
            value={
              (v.planned_release_at ?? v.requested_release_at ?? "") as string
            }
            onChange={(e) =>
              props.onChange({
                ...v,
                planned_release_at: e.target.value || null,
                requested_release_at: e.target.value || null,
              })
            }
          />
        </label>

        <div className="grid gap-1">
          <div className="text-xs text-neutral-600">Systems involved</div>
          <div className="flex flex-wrap gap-2">
            {SYSTEMS.map((s) => {
              const selected = ((v.systems_involved ?? []) as string[]).includes(
                s
              );
              return (
                <Button
                  key={s}
                  type="button"
                  className={`rounded-full border px-3 py-1 text-xs ${
                    selected ? "bg-neutral-200" : "bg-white"
                  }`}
                  onClick={() =>
                    props.onChange({
                      ...v,
                      systems_involved: toggleInArray(
                        (v.systems_involved ?? []) as string[],
                        s
                      ),
                    })
                  }
                >
                  {s}
                </Button>
              );
            })}
          </div>
        </div>

        <label className="flex items-center justify-between rounded-xl border px-3 py-2">
          <div className="text-sm">Backfill required?</div>
          <Input
            type="checkbox"
            checked={!!v.backfill_required}
            onChange={(e) =>
              props.onChange({ ...v, backfill_required: e.target.checked })
            }
          />
        </label>

        <label className="flex items-center justify-between rounded-xl border px-3 py-2">
          <div className="text-sm">Customer impact expected?</div>
          <Input
            type="checkbox"
            checked={!!v.customer_impact_expected}
            onChange={(e) =>
              props.onChange({
                ...v,
                customer_impact_expected: e.target.checked,
              })
            }
          />
        </label>

        {v.customer_impact_expected ? (
          <label className="grid gap-1 md:col-span-2">
            <div className="text-xs text-neutral-600">
              Affected customer segments (required if impact expected)
            </div>
            <Input
              className="rounded-xl border px-3 py-2"
              placeholder="e.g., New customers, Enterprise, Annual plans (comma-separated)"
              value={((v.affected_customer_segments ?? []) as string[]).join(
                ", "
              )}
              onChange={(e) =>
                props.onChange({
                  ...v,
                  affected_customer_segments: e.target.value
                    .split(",")
                    .map((x) => x.trim())
                    .filter(Boolean),
                })
              }
            />
          </label>
        ) : null}
      </div>
    </div>
  );
}
