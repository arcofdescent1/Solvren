"use client";

import * as React from "react";
import { trackAppEvent } from "@/lib/appAnalytics";
import { trackPhase4StepViewed } from "./phase4Analytics";

export function ExecutiveQBRStep(props: { onChanged: () => Promise<void> }) {
  const { onChanged } = props;
  const [busy, setBusy] = React.useState(false);
  const [msg, setMsg] = React.useState<string | null>(null);

  React.useEffect(() => {
    trackPhase4StepViewed("executive_qbrs");
  }, []);

  async function generate() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/onboarding/phase4/qbrs/generate", { method: "POST" });
      const j = (await res.json().catch(() => ({}))) as { error?: string; generatedReportId?: string };
      if (!res.ok) {
        setMsg(j.error ?? "Request failed");
        return;
      }
      setMsg(`Queued report ${j.generatedReportId ?? ""}. Delivery opens the weekly cadence clock.`);
      trackAppEvent("onboarding_phase4_qbr_generated", { generatedReportId: j.generatedReportId });
      await onChanged();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3 rounded-lg border border-[color:var(--rg-border)] bg-[color:var(--rg-surface)] p-4">
      <h3 className="text-sm font-semibold text-[color:var(--rg-text)]">Executive QBR cadence</h3>
      <p className="text-xs text-[color:var(--rg-text-muted)]">
        The 4-week streak uses <span className="font-medium">WEEKLY_EXECUTIVE_SUMMARY</span> rows linked to generated
        reports, delivered when processing completes, and opened by an executive in the same ISO week (org timezone).
      </p>
      <button
        type="button"
        disabled={busy}
        onClick={() => void generate()}
        className="rounded-md bg-[color:var(--rg-primary)] px-3 py-2 text-xs font-medium text-[color:var(--rg-primary-fg)] disabled:opacity-50"
      >
        {busy ? "Queueing…" : "Generate weekly executive summary"}
      </button>
      {msg ? <p className="text-xs text-[color:var(--rg-text-muted)]">{msg}</p> : null}
    </div>
  );
}
