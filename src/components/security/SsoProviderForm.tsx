"use client";

import { useState, useEffect } from "react";
import { Button, Input, Stack } from "@/ui";
import { Switch } from "@/ui/primitives/switch";
import SsoRoleMappingsEditor from "./SsoRoleMappingsEditor";

type Props = {
  orgId: string;
  providerId: string;
  onSaved: () => void;
  onCancel: () => void;
};

export default function SsoProviderForm({ orgId, providerId, onSaved, onCancel }: Props) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [issuer, setIssuer] = useState("");
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [domainHint, setDomainHint] = useState("");
  const [endSessionEndpoint, setEndSessionEndpoint] = useState("");
  const [enabled, setEnabled] = useState(false);
  const [enforceSso, setEnforceSso] = useState(false);
  const [allowLocalFallback, setAllowLocalFallback] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/org/settings/sso/providers/${providerId}?orgId=${encodeURIComponent(orgId)}`
        );
        const json = await res.json().catch(() => ({}));
        if (res.ok) {
          const d = json as Record<string, unknown>;
          setDisplayName(String(d.displayName ?? ""));
          setIssuer(String(d.issuer ?? ""));
          setClientId(String(d.clientId ?? ""));
          setDomainHint(String(d.domainHint ?? ""));
          setEndSessionEndpoint(String(d.endSessionEndpoint ?? ""));
          setEnabled(Boolean(d.enabled));
          setEnforceSso(Boolean(d.enforceSso));
          setAllowLocalFallback(d.allowLocalFallback !== false);
        }
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [orgId, providerId]);

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch(`/api/org/settings/sso/providers/${providerId}?orgId=${encodeURIComponent(orgId)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId: orgId,
          displayName,
          issuer: issuer || undefined,
          clientId: clientId || undefined,
          clientSecret: clientSecret || undefined,
          domainHint: domainHint || undefined,
          endSessionEndpoint: endSessionEndpoint || undefined,
          enabled,
          enforceSso,
          allowLocalFallback,
        }),
      });
      if (res.ok) onSaved();
    } finally {
      setSaving(false);
    }
  }

  async function handleTest() {
    setTesting(true);
    try {
      const res = await fetch(
        `/api/org/settings/sso/providers/${providerId}/test?orgId=${encodeURIComponent(orgId)}`,
        { method: "POST" }
      );
      const json = (await res.json().catch(() => ({}))) as { status?: string; checks?: Array<{ name: string; status: string }> };
      if (json.status === "ok") alert("Connection test passed.");
      else alert(JSON.stringify(json.checks ?? json));
    } finally {
      setTesting(false);
    }
  }

  if (loading) return <p className="text-sm text-[var(--text-muted)]">Loading…</p>;

  return (
    <div className="space-y-4 rounded border p-4">
      <h4 className="font-medium">Provider configuration</h4>
      <Stack gap={3}>
        <div>
          <label className="text-xs text-[var(--text-muted)]">Display name</label>
          <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Okta" />
        </div>
        <div>
          <label className="text-xs text-[var(--text-muted)]">Issuer URL (OIDC)</label>
          <Input
            value={issuer}
            onChange={(e) => setIssuer(e.target.value)}
            placeholder="https://your-org.okta.com/oauth2/default"
          />
        </div>
        <div>
          <label className="text-xs text-[var(--text-muted)]">Client ID</label>
          <Input value={clientId} onChange={(e) => setClientId(e.target.value)} placeholder="Client ID" />
        </div>
        <div>
          <label className="text-xs text-[var(--text-muted)]">Client secret</label>
          <Input
            type="password"
            value={clientSecret}
            onChange={(e) => setClientSecret(e.target.value)}
            placeholder="Leave blank to keep existing"
          />
        </div>
        <div>
          <label className="text-xs text-[var(--text-muted)]">Domain hint (optional)</label>
          <Input value={domainHint} onChange={(e) => setDomainHint(e.target.value)} placeholder="company.com" />
        </div>
        <div>
          <label className="text-xs text-[var(--text-muted)]">End session URL (optional, for IdP logout)</label>
          <Input
            value={endSessionEndpoint}
            onChange={(e) => setEndSessionEndpoint(e.target.value)}
            placeholder="https://idp.example.com/oidc/logout"
          />
        </div>
        <div className="flex items-center gap-2">
          <Switch checked={enabled} onCheckedChange={setEnabled} />
          <span className="text-sm">Enable provider</span>
        </div>
        <div className="flex items-center gap-2">
          <Switch checked={enforceSso} onCheckedChange={setEnforceSso} />
          <span className="text-sm">Enforce SSO (block local login)</span>
        </div>
        <div className="flex items-center gap-2">
          <Switch checked={allowLocalFallback} onCheckedChange={setAllowLocalFallback} />
          <span className="text-sm">Allow local fallback</span>
        </div>
      </Stack>
      <SsoRoleMappingsEditor orgId={orgId} providerId={providerId} />
      <div className="flex gap-2">
        <Button onClick={handleSave} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
        <Button variant="outline" onClick={handleTest} disabled={testing}>{testing ? "Testing…" : "Test"}</Button>
        <Button variant="ghost" onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  );
}
