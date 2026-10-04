"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { ImportKind } from "@/lib/import-schemas";
import { importTemplates } from "@/lib/import-templates";
import { usd } from "@/lib/finance";

type Role = "owner" | "finance" | "engineer" | "viewer";
type Customer = { id: string; name: string; external_id: string };
type Job = { id: string; kind: string; source: string; file_name: string | null; status: string;
  total_rows: number; rejected_rows: number; imported_rows: number; duplicate_rows: number;
  chunks_done: number; chunks_total: number; error_message: string | null; created_at: string };
type Mapping = { source: string; source_customer_id: string; event_count: number; known_cost_usd: string };
type Rate = { id: string; provider: string; model: string; effective_from: string;
  input_per_million_usd: string; output_per_million_usd: string;
  cache_read_per_million_usd: string; cache_write_per_million_usd: string };
type Statement = { id: string; provider: string; period_start: string; period_end: string;
  total_usd: string; source_file: string };
type Connection = { provider: string; connected_at: string };
type Key = { id: string; label: string; token_prefix: string; created_at: string;
  last_used_at: string | null; revoked_at: string | null };

const kinds: Array<{ kind: ImportKind; label: string; description: string; role: "finance" | "engineer" }> = [
  { kind: "contracts", label: "Contracts", description: "Versioned prices, allowances, discounts, and dates", role: "finance" },
  { kind: "usage", label: "AI usage", description: "One metadata-only row per model call or retry", role: "engineer" },
  { kind: "outcomes", label: "Run outcomes", description: "Completed, failed, or cancelled run IDs", role: "engineer" },
  { kind: "direct_costs", label: "Other direct costs", description: "Tool and human-review costs attached to runs", role: "engineer" },
  { kind: "statements", label: "Supplier statements", description: "OpenAI or Anthropic totals for a defined period", role: "finance" },
];

export function DataConsole({ orgId, role, period, targetMarginPct, customers, jobs, unmapped, rates,
  statements, connections, keys }: {
  orgId: string; role: Role; period: { from: string; to: string; days: number }; targetMarginPct: string;
  customers: Customer[]; jobs: Job[]; unmapped: Mapping[]; rates: Rate[];
  statements: Statement[]; connections: Connection[]; keys: Key[];
}) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [newKey, setNewKey] = useState("");
  const engineer = role === "owner" || role === "engineer";
  const finance = role === "owner" || role === "finance";
  useEffect(() => {
    if (!jobs.some((job) => ["preparing", "queued", "running"].includes(job.status))) return;
    const interval = window.setInterval(() => router.refresh(), 10_000);
    return () => window.clearInterval(interval);
  }, [jobs, router]);
  function notice(text: string, error = false) { setMessage(text); setIsError(error); }
  async function sendJson(path: string, method: string, body: unknown) {
    const response = await fetch(path, { method, headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error ?? "Request failed.");
    return result;
  }
  async function upload(event: React.FormEvent<HTMLFormElement>, kind: ImportKind) {
    event.preventDefault(); setBusy(true); notice("");
    const form = event.currentTarget;
    try {
      const response = await fetch(`/api/organizations/${orgId}/imports`, {
        method: "POST", body: new FormData(form),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Import failed.");
      notice(kind === "contracts" || kind === "statements"
        ? `${result.imported} financial rows imported.`
        : `${result.accepted} rows queued; ${result.rejected} rows quarantined. Track the job below.`);
      form.reset(); router.refresh();
    } catch (error) { notice(error instanceof Error ? error.message : "Import failed.", true); }
    finally { setBusy(false); }
  }
  async function submitJson(event: React.FormEvent<HTMLFormElement>, path: string,
    body: (form: FormData) => unknown, success: string) {
    event.preventDefault(); setBusy(true); notice("");
    const form = event.currentTarget;
    try { await sendJson(path, "POST", body(new FormData(form))); notice(success); form.reset(); router.refresh(); }
    catch (error) { notice(error instanceof Error ? error.message : "Could not save.", true); }
    finally { setBusy(false); }
  }
  async function createKey(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); notice("");
    const form = event.currentTarget;
    const data = new FormData(form);
    try {
      const result = await sendJson(`/api/organizations/${orgId}/keys`, "POST", {
        label: data.get("label"), code: data.get("code"),
      });
      setNewKey(result.token); notice("Key created. Copy it now; it will not be shown again.");
      form.reset(); router.refresh();
    } catch (error) { notice(error instanceof Error ? error.message : "Could not create key.", true); }
    finally { setBusy(false); }
  }
  async function revokeKey(keyId: string) {
    const code = window.prompt("Enter your current six-digit authenticator code to revoke this key.");
    if (!code) return;
    setBusy(true); notice("");
    try { await sendJson(`/api/organizations/${orgId}/keys/${keyId}`, "DELETE", { code });
      notice("Ingestion key revoked."); router.refresh(); }
    catch (error) { notice(error instanceof Error ? error.message : "Could not revoke key.", true); }
    finally { setBusy(false); }
  }
  async function disconnect(provider: string) {
    const code = window.prompt(`Enter your authenticator code to disconnect ${provider} Langfuse.`);
    if (!code) return;
    setBusy(true); notice("");
    try { await sendJson(`/api/organizations/${orgId}/langfuse`, "DELETE", { provider, code });
      notice("Langfuse connection removed."); router.refresh(); }
    catch (error) { notice(error instanceof Error ? error.message : "Could not disconnect.", true); }
    finally { setBusy(false); }
  }
  return <>
    {message && <p className={`message ${isError ? "error" : ""}`} role="alert">{message}</p>}
    <section className="card"><div className="section-heading"><div><h2>1 · Import your files</h2><p>Download a template, fill it with your identifiers, then upload. Raw prompts and responses are never accepted.</p></div></div>
      <div className="import-grid">{kinds.map(({ kind, label, description, role: required }) => {
        const allowed = role === "owner" || role === required;
        const template = `data:text/csv;charset=utf-8,${encodeURIComponent(importTemplates[kind].join(",") + "\r\n")}`;
        return <div className="import-tile" key={kind}><h3>{label}</h3><p>{description}</p><a className="table-link small" href={template} download={`solvren-${kind}-template.csv`}>Download CSV template ↓</a>
          {allowed && <form className="stack" onSubmit={(event) => upload(event, kind)}>
            <input type="hidden" name="kind" value={kind}/>
            <div className="field"><label htmlFor={`${kind}-source`}>Source ID</label><input className="input" id={`${kind}-source`} name="source" defaultValue={kind === "contracts" || kind === "statements" ? "finance_csv" : "application"} required/></div>
            <div className="field"><label htmlFor={`${kind}-file`}>CSV file</label><input className="input" id={`${kind}-file`} type="file" name="file" accept=".csv,text/csv" required/></div>
            <button className="button secondary" disabled={busy}>Upload {label.toLowerCase()}</button>
          </form>}
        </div>;
      })}</div>
      <p className="small" style={{marginTop:20}}>Dates use ISO 8601. USD amounts use a period as the decimal separator. Event IDs must be stable across replays. Usage input and cache token buckets must be mutually exclusive. A file contains up to 10,000 rows or 4 MB; larger histories can be split across files.</p>
    </section>
    <section className="card section"><div className="section-heading"><div><h2>Import activity</h2><p>Retries never count the same source event twice. Invalid rows have downloadable reasons.</p></div><button className="button ghost" onClick={() => router.refresh()}>Refresh</button></div>
      {jobs.length === 0 ? <p>No import jobs yet.</p> : <div className="table-scroll"><table><thead><tr><th>When / source</th><th>Type</th><th>State</th><th>Imported</th><th>Duplicate</th><th>Rejected</th></tr></thead><tbody>{jobs.map((job) => <tr key={job.id}><td>{new Date(job.created_at).toLocaleString()}<small>{job.file_name ?? job.source}</small></td><td>{job.kind}</td><td><span className="pill">{job.status}</span><small>{job.chunks_done}/{job.chunks_total} chunks {job.error_message ? `· ${job.error_message}` : ""}</small></td><td>{job.imported_rows}</td><td>{job.duplicate_rows}</td><td>{job.rejected_rows > 0 ? <a className="table-link" href={`/api/organizations/${orgId}/imports/${job.id}/rejections`}>{job.rejected_rows} · download</a> : "0"}</td></tr>)}</tbody></table></div>}
    </section>
    <section className="card section" id="mapping"><div className="section-heading"><div><h2>2 · Resolve customer IDs</h2><p>Unmatched usage, outcomes, and direct costs stay visible and out of customer totals until mapped.</p></div><span className="pill">{unmapped.length} source IDs</span></div>
      <form className="inline-form" method="get"><div className="field"><label htmlFor="mapping-from">From</label><input className="input" id="mapping-from" type="date" name="from" defaultValue={period.from}/></div><div className="field"><label htmlFor="mapping-to">To, exclusive</label><input className="input" id="mapping-to" type="date" name="to" defaultValue={period.to}/></div><button className="button secondary">Update</button></form>
      {unmapped.length === 0 ? <p style={{marginTop:20}}>No unmapped events in this period.</p> : unmapped.map((item) => <div className="row" key={`${item.source}/${item.source_customer_id}`}><div><b>{item.source_customer_id}</b><div className="row-sub">{item.source} · {item.event_count} events · {usd(item.known_cost_usd)} measured cost</div></div>{(engineer || finance) && <form className="inline-form" onSubmit={(event) => submitJson(event, `/api/organizations/${orgId}/mappings`, (form) => ({ source: item.source, sourceCustomerId: item.source_customer_id, customerId: form.get("customerId") }), "Customer mapping saved. Historical reports now use it.")}><label className="small">Map to customer<select className="select" name="customerId" required defaultValue=""><option value="" disabled>Select a contract</option>{customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name} · {customer.external_id}</option>)}</select></label><button className="button secondary" disabled={busy || customers.length === 0}>Map</button></form>}</div>)}
    </section>
    {finance && <section className="card section"><h2>Organization margin target</h2><p>The default contribution-margin floor is {targetMarginPct}%. A contract may override it in its terms.</p><form className="inline-form" onSubmit={(event) => submitJson(event, `/api/organizations/${orgId}/target`, (form) => ({ targetMarginPct: form.get("targetMarginPct") }), "Organization margin target saved. Reports now use the new floor.")}><label className="field">Target margin %<input className="input" name="targetMarginPct" type="number" min="0" max="100" step="0.01" defaultValue={targetMarginPct} required/></label><button className="button secondary" disabled={busy}>Save target</button></form></section>}
    {(engineer || finance) && <section className="grid section">
      <div className="card"><h2>3 · Model rate cards</h2><p>Measured source cost takes precedence. A rate card prices otherwise unpriced token usage from its effective date.</p>
        <form className="stack" onSubmit={(event) => submitJson(event, `/api/organizations/${orgId}/rates`, (form) => ({ provider: form.get("provider"), model: form.get("model"), effectiveFrom: form.get("effectiveFrom"), input: form.get("input"), output: form.get("output"), cacheRead: form.get("cacheRead"), cacheWrite: form.get("cacheWrite") }), "Rate version saved. Reports recalculate from source data.")}>
          <div className="inline-form"><label className="field">Provider<select className="select" name="provider"><option>openai</option><option>anthropic</option></select></label><label className="field">Model<input className="input" name="model" required maxLength={200}/></label></div><label className="field">Effective from<input className="input" type="date" name="effectiveFrom" required/></label>
          <div className="inline-form">{["input", "output", "cacheRead", "cacheWrite"].map((field) => <label className="field" key={field}>{field} $ / 1M<input className="input" type="number" min="0" step="0.00000001" name={field} defaultValue="0" required/></label>)}</div><button className="button" disabled={busy}>Save rate version</button>
        </form><div className="compact-list">{rates.slice(0, 8).map((rate) => <div className="row" key={rate.id}><div><b>{rate.provider} · {rate.model}</b><div className="row-sub">From {rate.effective_from} · input {usd(rate.input_per_million_usd)} / 1M · output {usd(rate.output_per_million_usd)} / 1M</div></div></div>)}</div>
      </div>
      <div className="card"><h2>Supplier statements</h2><p>Import one non-overlapping period per provider. These totals reveal unattributed or missing model spend.</p>{statements.length === 0 ? <p>No statements imported.</p> : statements.map((item) => <div className="row" key={item.id}><div><b>{item.provider} · {usd(item.total_usd)}</b><div className="row-sub">{item.period_start} to {item.period_end} · {item.source_file}</div></div></div>)}</div>
    </section>}
    {engineer && <section className="grid section"><div className="card"><h2>Langfuse observations</h2><p>Connect a Langfuse v4 project for one provider. Solvren fetches only IDs, model, usage, cost, and trace name; it never requests input, output, or metadata.</p>
      <form className="stack" onSubmit={(event) => submitJson(event, `/api/organizations/${orgId}/langfuse`, (form) => ({ provider: form.get("provider"), region: form.get("region"), publicKey: form.get("publicKey"), secretKey: form.get("secretKey"), code: form.get("code") }), "Langfuse credentials verified and stored securely.")}>
        <div className="inline-form"><label className="field">Provider<select className="select" name="provider"><option>openai</option><option>anthropic</option></select></label><label className="field">Region<select className="select" name="region"><option value="us">US</option><option value="eu">EU</option><option value="jp">Japan</option><option value="hipaa_us">HIPAA US</option></select></label></div>
        <label className="field">Public key<input className="input" name="publicKey" autoComplete="off" required/></label><label className="field">Secret key<input className="input" name="secretKey" type="password" autoComplete="off" required/></label><label className="field">Authenticator code<input className="input code" name="code" inputMode="numeric" pattern="[0-9]{6}" required/></label><button className="button" disabled={busy}>Verify & connect</button>
      </form>
      {connections.map((connection) => <div className="row" key={connection.provider}><div><b>{connection.provider} connected</b><div className="row-sub">Updated {new Date(connection.connected_at).toLocaleString()}</div></div><button className="button ghost" disabled={busy} onClick={() => disconnect(connection.provider)}>Disconnect</button></div>)}
      {connections.length > 0 && <form className="stack" onSubmit={(event) => submitJson(event, `/api/organizations/${orgId}/langfuse/sync`, (form) => ({ provider: form.get("provider"), from: form.get("from"), to: form.get("to") }), "Langfuse backfill queued. Track it under Import activity.")}><h3>Backfill observations</h3><label className="field">Provider<select className="select" name="provider">{connections.map((connection) => <option key={connection.provider}>{connection.provider}</option>)}</select></label><div className="inline-form"><label className="field">From<input className="input" type="date" name="from" defaultValue={period.from} required/></label><label className="field">To, exclusive<input className="input" type="date" name="to" defaultValue={period.to} required/></label></div><button className="button secondary" disabled={busy}>Sync up to 31 days</button></form>}
    </div><div className="card"><h2>Batch ingestion API</h2><p>Send metadata-only JSON events to <code>/api/ingest/events</code> with a bearer key. Keys appear once and can be revoked at any time.</p>
      <form className="stack" onSubmit={createKey}><label className="field">Key label<input className="input" name="label" placeholder="Production event emitter" required/></label><label className="field">Authenticator code<input className="input code" name="code" inputMode="numeric" pattern="[0-9]{6}" required/></label><button className="button" disabled={busy}>Create ingestion key</button></form>
      {newKey && <div className="message" style={{marginTop:15}}><b>Copy this key now</b><code className="secret-key">{newKey}</code><button className="button ghost" onClick={() => navigator.clipboard.writeText(newKey)}>Copy key</button></div>}
      {keys.filter((key) => !key.revoked_at).map((key) => <div className="row" key={key.id}><div><b>{key.label}</b><div className="row-sub">{key.token_prefix}… · Last used {key.last_used_at ? new Date(key.last_used_at).toLocaleString() : "never"}</div></div><button className="button ghost" disabled={busy} onClick={() => revokeKey(key.id)}>Revoke</button></div>)}
    </div></section>}
    <section className="card section"><h2>How the audit treats missing data</h2><p>Unmapped events are excluded from customer totals but remain in the mapping queue. An unknown model without source-reported cost is marked unpriced, never zero. Langfuse may infer its own reported cost; a supplier statement is needed to compare it with billed spend. Failed attempts and direct tool or review costs stay in the run’s economics. A completed-outcome cost appears only when outcome IDs are supplied.</p></section>
  </>;
}
