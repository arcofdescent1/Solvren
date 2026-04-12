"use client";

import * as React from "react";
import { trackAppEvent } from "@/lib/appAnalytics";
import { trackPhase4StepViewed } from "./phase4Analytics";

const TYPES = [
  { value: "BUSINESS_UNIT", label: "Business unit" },
  { value: "REGION", label: "Region" },
  { value: "SUBSIDIARY", label: "Subsidiary" },
  { value: "DIVISION", label: "Division" },
] as const;

export function ExpandOrgFootprintStep(props: { onChanged: () => Promise<void> }) {
  const { onChanged } = props;
  const [name, setName] = React.useState("");
  const [type, setType] = React.useState<string>("BUSINESS_UNIT");
  const [busy, setBusy] = React.useState(false);
  const [msg, setMsg] = React.useState<string | null>(null);

  React.useEffect(() => {
    trackPhase4StepViewed("expand_org_footprint");
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const savedName = name;
    const savedType = type;
    try {
      const res = await fetch("/api/onboarding/phase4/business-unit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: savedName, type: savedType }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        setMsg(j.error ?? "Request failed");
        return;
      }
      setName("");
      await onChanged();
      setMsg("Saved.");
      trackAppEvent("onboarding_phase4_business_unit_added", { name: savedName, type: savedType });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3 rounded-lg border border-[color:var(--rg-border)] bg-[color:var(--rg-surface)] p-4">
      <h3 className="text-sm font-semibold text-[color:var(--rg-text)]">Expand organizational footprint</h3>
      <p className="text-xs text-[color:var(--rg-text-muted)]">
        Add business units, regions, or subsidiaries. Each unit counts when it has members and qualifying usage in the
        last 30 days.
      </p>
      <form onSubmit={submit} className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <label className="flex-1 text-xs">
          <span className="text-[color:var(--rg-text-muted)]">Name</span>
          <input
            className="mt-1 w-full rounded-md border border-[color:var(--rg-border)] bg-transparent px-2 py-1.5 text-sm"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </label>
        <label className="text-xs sm:w-44">
          <span className="text-[color:var(--rg-text-muted)]">Type</span>
          <select
            className="mt-1 w-full rounded-md border border-[color:var(--rg-border)] bg-transparent px-2 py-1.5 text-sm"
            value={type}
            onChange={(e) => setType(e.target.value)}
          >
            {TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          disabled={busy}
          className="rounded-md bg-[color:var(--rg-primary)] px-3 py-2 text-xs font-medium text-[color:var(--rg-primary-fg)] disabled:opacity-50"
        >
          {busy ? "Saving…" : "Add unit"}
        </button>
      </form>
      {msg ? <p className="text-xs text-[color:var(--rg-text-muted)]">{msg}</p> : null}
    </div>
  );
}
