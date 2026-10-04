"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Role = "owner" | "finance" | "engineer" | "viewer";
type Connection = { provider: string; connected_at: string; disconnected_at: string | null;
  last_success_at: string | null; last_error: string | null; synced_through: string | null };

export function ConnectionConsole({ orgId, role, connections, nowMs }: {
  orgId: string; role: Role; connections: Connection[]; nowMs: number;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);
  async function send(path: string, method: string, body: unknown) {
    setBusy(true); setMessage(""); setError(false);
    try {
      const response = await fetch(path, { method, headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Connection action failed.");
      setMessage(method === "DELETE" ? "Connection removed and stored credential deleted."
        : path.endsWith("/sync") ? "Sync queued. Progress appears below." : "Credential verified. Initial sync queued.");
      router.refresh();
    } catch (reason) { setError(true); setMessage(reason instanceof Error ? reason.message : "Connection action failed."); }
    finally { setBusy(false); }
  }
  const allowed = (provider: string) => role === "owner"
    || (provider === "stripe" ? role === "finance" : role === "engineer");
  return <section className="card section"><div className="section-heading"><div><h2>Source connections</h2><p>Connect only the billing account that pays for this usage. Credentials stay in Vault and are never shown again.</p></div></div>
    {message && <p className={`message ${error ? "error" : ""}`} role="alert">{message}</p>}
    <div className="import-grid">{(["openai", "anthropic", "stripe"] as const).map((provider) => {
      const connection = connections.find((item) => item.provider === provider);
      const active = connection && !connection.disconnected_at;
      const stale = active && (!connection.last_success_at || nowMs - Date.parse(connection.last_success_at) > 24 * 3600_000);
      return <div className="import-tile" key={provider}><h3>{provider === "stripe" ? "Stripe revenue" : `${provider} supplier cost`}</h3>
        <p>{provider === "stripe" ? "Restricted read-only key: Customers, Subscriptions, Invoices. Contract value always needs Finance confirmation."
          : provider === "anthropic" ? "Claude Console Admin API cost report. Priority Tier and cloud-reseller billing are outside this endpoint."
          : "OpenAI organization Admin Costs API. Reports project and line-item spend, never customer identity."}</p>
        <div className="row-sub">{active ? `Connected · last success ${connection.last_success_at ? new Date(connection.last_success_at).toLocaleString() : "never"} · through ${connection.synced_through ?? "none"}` : "Not connected"}</div>
        {active && <p className="small">{stale ? "Stale or awaiting first sync" : "Current"}{connection.last_error ? ` · ${connection.last_error}` : ""}</p>}
        {allowed(provider) && <>
          <details className="section"><summary className="table-link">{active ? "Replace credential" : "Connect"}</summary>
            <form className="stack" onSubmit={(event) => { event.preventDefault(); const form = event.currentTarget; const values = new FormData(form);
              void send(`/api/organizations/${orgId}/connections`, "POST", { provider,
                key: values.get("key"), code: values.get("code") }).then(() => form.reset()); }}>
              <label className="field">{provider === "stripe" ? "Restricted key (rk_…)" : "Organization admin key"}<input className="input" name="key" type="password" autoComplete="off" required/></label>
              <label className="field">Authenticator code<input className="input code" name="code" inputMode="numeric" pattern="[0-9]{6}" required/></label>
              <button className="button" disabled={busy}>Verify & connect</button></form></details>
          {active && <div className="inline-form section"><button className="button secondary" disabled={busy}
            onClick={() => void send(`/api/organizations/${orgId}/connections/sync`, "POST", { provider, days: 30 })}>Replay 30 days</button>
            <details><summary className="table-link">Disconnect</summary><form className="stack" onSubmit={(event) => { event.preventDefault(); const form = event.currentTarget;
              void send(`/api/organizations/${orgId}/connections`, "DELETE", { provider,
                code: new FormData(form).get("code") }).then(() => form.reset()); }}><label className="field">Authenticator code<input className="input code" name="code" inputMode="numeric" pattern="[0-9]{6}" required/></label><button className="button danger" disabled={busy}>Delete credential</button></form></details></div>}
        </>}
      </div>;
    })}</div>
  </section>;
}
