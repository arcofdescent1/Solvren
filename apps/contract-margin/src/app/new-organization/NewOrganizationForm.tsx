"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function NewOrganizationForm() {
  const router = useRouter();
  const [name,setName] = useState("");
  const [error,setError] = useState("");
  const [busy,setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError("");
    const response = await fetch("/api/organizations", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({name}) });
    const data = await response.json(); setBusy(false);
    if (!response.ok) { setError(data.error ?? "Could not create the organization."); return; }
    router.push(`/mfa?next=${encodeURIComponent(`/o/${data.organizationId}`)}`); router.refresh();
  }
  return <form onSubmit={submit}><h2>Organization details</h2><p>This name appears to everyone you invite.</p>
    <div className="field"><label htmlFor="org-name">Organization name</label><input id="org-name" className="input" maxLength={80} minLength={2} autoComplete="organization" placeholder="Acme AI" value={name} onChange={e=>setName(e.target.value)} required/></div>
    {error && <p className="message error" role="alert">{error}</p>}
    <button className="button" disabled={busy}>{busy?"Creating…":"Create organization"}</button>
  </form>;
}
