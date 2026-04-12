"use client";

import * as React from "react";
import { trackAppEvent } from "@/lib/appAnalytics";
import { trackPhase4StepViewed } from "./phase4Analytics";

export function SystemOfRecordStep(props: { onChanged: () => Promise<void> }) {
  const { onChanged } = props;
  const [busy, setBusy] = React.useState<string | null>(null);
  const [msg, setMsg] = React.useState<string | null>(null);

  React.useEffect(() => {
    trackPhase4StepViewed("become_system_of_record");
  }, []);

  async function post(signalType: "PRIMARY_DASHBOARD_SET" | "QBR_REFERENCED" | "CS_CONFIRMED_SYSTEM_OF_RECORD") {
    setBusy(signalType);
    setMsg(null);
    try {
      const res = await fetch("/api/onboarding/phase4/system-of-record", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signalType, signalValue: null }),
      });
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setMsg(j.error ?? "Request failed");
        return;
      }
      setMsg("Recorded.");
      trackAppEvent("onboarding_phase4_system_of_record_confirmed", { signalType });
      await onChanged();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-3 rounded-lg border border-[color:var(--rg-border)] bg-[color:var(--rg-surface)] p-4">
      <h3 className="text-sm font-semibold text-[color:var(--rg-text)]">Become the system of record</h3>
      <p className="text-xs text-[color:var(--rg-text-muted)]">
        Confirmation is stored as adoption signals. Primary dashboard and QBR references are org-admin actions;
        customer-success confirmation requires CS or super-admin roles.
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy != null}
          onClick={() => void post("PRIMARY_DASHBOARD_SET")}
          className="rounded-md border border-[color:var(--rg-border)] px-3 py-1.5 text-xs font-medium disabled:opacity-50"
        >
          {busy === "PRIMARY_DASHBOARD_SET" ? "Saving…" : "Set Solvren as primary dashboard"}
        </button>
        <button
          type="button"
          disabled={busy != null}
          onClick={() => void post("QBR_REFERENCED")}
          className="rounded-md border border-[color:var(--rg-border)] px-3 py-1.5 text-xs font-medium disabled:opacity-50"
        >
          {busy === "QBR_REFERENCED" ? "Saving…" : "Mark reporting primary source"}
        </button>
        <button
          type="button"
          disabled={busy != null}
          onClick={() => void post("CS_CONFIRMED_SYSTEM_OF_RECORD")}
          className="rounded-md border border-[color:var(--rg-border)] px-3 py-1.5 text-xs font-medium disabled:opacity-50"
        >
          {busy === "CS_CONFIRMED_SYSTEM_OF_RECORD" ? "Saving…" : "CS confirm system of record"}
        </button>
      </div>
      {msg ? <p className="text-xs text-[color:var(--rg-text-muted)]">{msg}</p> : null}
    </div>
  );
}
