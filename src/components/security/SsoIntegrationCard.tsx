"use client";

import { useCallback, useEffect, useState } from "react";
import { Button, Card, CardBody, Stack, Badge } from "@/ui";
import SsoProviderForm from "./SsoProviderForm";

type Provider = {
  id: string;
  providerType: string;
  protocol: string;
  displayName: string;
  enabled?: boolean;
  enforceSso?: boolean;
  allowLocalFallback?: boolean;
};

type Config = {
  enabled: boolean;
  enforceSso: boolean;
  providers: Provider[];
  roleMappings: unknown[];
};

type Props = {
  orgId: string;
  isAdmin: boolean;
};

export default function SsoIntegrationCard({ orgId, isAdmin }: Props) {
  const [config, setConfig] = useState<Config | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const fetchConfig = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/org/settings/sso?orgId=${encodeURIComponent(orgId)}`);
      const json = await res.json().catch(() => ({}));
      if (res.ok) setConfig(json as Config);
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    void fetchConfig();
  }, [fetchConfig]);

  async function handleCreateProvider(providerType: string, protocol: string) {
    if (!isAdmin) return;
    setCreating(true);
    try {
      const res = await fetch("/api/org/settings/sso/providers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId: orgId,
          providerType,
          protocol,
          displayName: `${providerType} (${protocol})`,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok && (json as { id?: string }).id) {
        setEditingId((json as { id: string }).id);
        await fetchConfig();
      }
    } finally {
      setCreating(false);
    }
  }

  if (loading) {
    return (
      <Card>
        <CardBody>
          <p className="text-sm text-[var(--text-muted)]">Loading…</p>
        </CardBody>
      </Card>
    );
  }

  const providers = config?.providers ?? [];
  const hasProviders = providers.length > 0;

  return (
    <Card>
      <CardBody>
        <Stack gap={4}>
          <div className="flex items-center justify-between">
            <span className="font-semibold">SSO Providers</span>
            {config?.enforceSso && (
              <Badge variant="default">SSO enforced</Badge>
            )}
          </div>
          <p className="text-xs text-[var(--text-muted)]">
            Add Okta, Google Workspace, Microsoft Entra ID, or custom OIDC/SAML. Users can sign in with their corporate identity.
          </p>

          {hasProviders && (
            <div className="space-y-2">
              {providers.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between rounded border p-3"
                >
                  <div>
                    <span className="font-medium">{p.displayName}</span>
                    <span className="ml-2 text-xs text-[var(--text-muted)]">
                      {p.providerType} · {p.protocol}
                    </span>
                    {p.enabled && (
                      <Badge variant="outline" className="ml-2 text-xs">Enabled</Badge>
                    )}
                  </div>
                  {isAdmin && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setEditingId(editingId === p.id ? null : p.id)}
                    >
                      {editingId === p.id ? "Done" : "Edit"}
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}

          {isAdmin && (
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={creating}
                onClick={() => handleCreateProvider("okta", "saml")}
              >
                Add Okta (SAML)
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={creating}
                onClick={() => handleCreateProvider("saml_custom", "saml")}
              >
                Add SAML provider
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={creating}
                onClick={() => handleCreateProvider("oidc_custom", "oidc")}
              >
                Add OIDC provider
              </Button>
            </div>
          )}

          {editingId && isAdmin && (
            <SsoProviderForm
              orgId={orgId}
              providerId={editingId}
              onSaved={() => {
                setEditingId(null);
                fetchConfig();
              }}
              onCancel={() => setEditingId(null)}
            />
          )}
        </Stack>
      </CardBody>
    </Card>
  );
}
