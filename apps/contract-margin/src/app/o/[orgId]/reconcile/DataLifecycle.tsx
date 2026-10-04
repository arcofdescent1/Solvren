"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const datasets = ["customers", "mappings", "contracts", "rates", "usage", "outcomes",
  "direct_costs", "statements", "provider_costs", "provider_days", "stripe_customers",
  "stripe_subscriptions", "stripe_invoices", "reports"];

export function DataLifecycle({ orgId, owner }: { orgId: string; owner: boolean }) {
  const router = useRouter();
  const [dataset, setDataset] = useState("usage");
  const [cursor, setCursor] = useState("");
  const [pages, setPages] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function download() {
    setBusy(true); setMessage("");
    try {
      const url = new URL(`/api/organizations/${orgId}/export`, window.location.origin);
      url.searchParams.set("dataset", dataset);
      if (cursor) url.searchParams.set("after", cursor);
      const response = await fetch(url);
      if (!response.ok) throw new Error("The export page could not be downloaded.");
      const blob = await response.blob();
      const href = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = href; anchor.download = `solvren-${dataset}-${pages + 1}.csv`;
      anchor.click(); setTimeout(() => URL.revokeObjectURL(href), 30_000);
      const next = response.headers.get("X-Next-Cursor") ?? "";
      setCursor(next); setPages((value) => value + 1);
      setMessage(next ? "Page saved. Continue for the next page." : "Dataset export complete.");
    } catch (reason) { setMessage(reason instanceof Error ? reason.message : "Export failed."); }
    finally { setBusy(false); }
  }
  async function requestDeletion(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch(`/api/organizations/${orgId}/deletion`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmation: form.get("confirmation"), code: form.get("code") }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Closure failed.");
      router.replace("/workspace"); router.refresh();
    } catch (reason) { setMessage(reason instanceof Error ? reason.message : "Closure failed."); }
    finally { setBusy(false); }
  }
  return <section className="card section"><h2>Data export & retention</h2><p>Normalized events are retained for 13 months. Download each dataset as authenticated CSV pages; each response is private and never cached. Frozen reports remain until the organization is deleted.</p>
    <div className="inline-form"><label className="field">Dataset<select className="select" value={dataset} onChange={(event) => { setDataset(event.target.value); setCursor(""); setPages(0); setMessage(""); }}>{datasets.map((value) => <option key={value} value={value}>{value.replaceAll("_", " ")}</option>)}</select></label><button className="button secondary" type="button" disabled={busy || (pages > 0 && !cursor)} onClick={() => void download()}>{pages ? "Download next page" : "Download first page"}</button><button className="button ghost" type="button" onClick={() => { setCursor(""); setPages(0); setMessage(""); }}>Start again</button></div>
    {message && <p className="small" role="status">{message}</p>}
    {owner && <details className="section"><summary className="table-link">Close and delete this organization</summary><p>Access ends immediately, connector credentials and ingestion keys are revoked, and retained data is permanently removed within 30 days. Export what you need first.</p><form className="stack" onSubmit={(event) => void requestDeletion(event)}><label className="field">Type DELETE MY ORGANIZATION<input className="input" name="confirmation" required pattern="DELETE MY ORGANIZATION"/></label><label className="field">Authenticator code<input className="input code" name="code" inputMode="numeric" pattern="[0-9]{6}" required/></label><button className="button danger" disabled={busy}>End access and schedule deletion</button></form></details>}
  </section>;
}
