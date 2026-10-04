"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ContractEditor({ orgId, initial }: { orgId: string; initial?: {
  customerId: string; customerName: string; billingPeriod: string; baseFeeUsd: string;
  includedOutcomes: number; overageUsd: string; discountPct: string;
  targetMarginPct: string | null; renewalOn: string | null;
} }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage("");
    const form = event.currentTarget;
    const fields = new FormData(form);
    const body: Record<string, unknown> = Object.fromEntries(fields.entries());
    body.includedOutcomes = Number(fields.get("includedOutcomes"));
    if (!body.targetMarginPct) delete body.targetMarginPct;
    if (!body.renewalOn) delete body.renewalOn;
    try {
      const response = await fetch(`/api/organizations/${orgId}/contracts`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Contract could not be saved.");
      setError(false); setMessage("Contract version saved. Historical versions remain in the record.");
      if (!initial) form.reset();
      router.refresh();
    } catch (reason) { setError(true); setMessage(reason instanceof Error ? reason.message : "Contract could not be saved."); }
    finally { setBusy(false); }
  }
  return <form className="stack" onSubmit={submit}>
    <div className="inline-form"><label className="field">Customer ID<input className="input" name="customerId" defaultValue={initial?.customerId} readOnly={Boolean(initial)} required maxLength={200}/></label><label className="field">Customer name<input className="input" name="customerName" defaultValue={initial?.customerName} required maxLength={200}/></label></div>
    <div className="inline-form"><label className="field">Effective from<input className="input" type="date" name="effectiveFrom" required/></label><label className="field">Billing period<select className="select" name="billingPeriod" defaultValue={initial?.billingPeriod ?? "monthly"}><option value="monthly">Monthly</option><option value="annual">Annual</option></select></label></div>
    <div className="inline-form"><label className="field">Base fee, USD<input className="input" type="number" min="0" step="0.01" name="baseFeeUsd" defaultValue={initial?.baseFeeUsd ?? "0"} required/></label><label className="field">Included completed outcomes / month<input className="input" type="number" min="0" step="1" name="includedOutcomes" defaultValue={initial?.includedOutcomes ?? 0} required/></label><label className="field">Overage per outcome, USD<input className="input" type="number" min="0" step="0.000001" name="overageUsd" defaultValue={initial?.overageUsd ?? "0"} required/></label></div>
    <div className="inline-form"><label className="field">Discount %<input className="input" type="number" min="0" max="100" step="0.01" name="discountPct" defaultValue={initial?.discountPct ?? "0"} required/></label><label className="field">Target margin % (blank uses organization default)<input className="input" type="number" min="0" max="100" step="0.01" name="targetMarginPct" defaultValue={initial?.targetMarginPct ?? ""}/></label><label className="field">Renewal / decision date<input className="input" type="date" name="renewalOn" defaultValue={initial?.renewalOn ?? ""}/></label></div>
    <p className="small">A new effective date closes the previous version; prices are never rewritten in past reports. Annual fees are allocated daily for management reporting.</p>
    {message && <p className={`message ${error ? "error" : ""}`} role="alert">{message}</p>}
    <div><button className="button" disabled={busy}>{busy ? "Saving…" : initial ? "Save new version" : "Create contract"}</button></div>
  </form>;
}
