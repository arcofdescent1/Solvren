"use client";

import * as React from "react";
import { Button, Card, CardBody, Checkbox } from "@/ui";

type Domain = { key: string; name: string; is_active: boolean };
type User = { user_id: string; role: string; email: string | null; name: string | null };
type Permission = { id: string; user_id: string; domain: string; can_view: boolean; can_review: boolean };

export default function DomainPermissionsClient({ orgId }: { orgId: string }) {
  const [domains, setDomains] = React.useState<Domain[]>([]);
  const [users, setUsers] = React.useState<User[]>([]);
  const [perms, setPerms] = React.useState<Permission[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [savingKey, setSavingKey] = React.useState<string | null>(null);
  const [message, setMessage] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/settings/domain-permissions?orgId=${encodeURIComponent(orgId)}`);
    const json = (await res.json()) as { users?: User[]; domains?: Domain[]; permissions?: Permission[] };
    if (res.ok) {
      setUsers(json.users ?? []);
      setDomains(json.domains ?? []);
      setPerms(json.permissions ?? []);
    }
    setLoading(false);
  }, [orgId]);

  React.useEffect(() => {
    void load();
  }, [load]);

  function getPerm(userId: string, domain: string) {
    return perms.find((p) => p.user_id === userId && p.domain === domain) ?? null;
  }

  async function save(userId: string, domain: string, canView: boolean, canReview: boolean) {
    const key = `${userId}:${domain}`;
    setSavingKey(key);
    setMessage(null);
    const res = await fetch("/api/settings/domain-permissions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orgId, userId, domain, canView, canReview }),
    });
    setSavingKey(null);
    if (!res.ok) {
      setMessage("Failed to save domain permission.");
      return;
    }
    setMessage("Domain permission updated.");
    await load();
  }

  if (loading) {
    return (
      <Card>
        <CardBody>
          <p className="text-sm text-[var(--text-muted)]">Loading domain permissions…</p>
        </CardBody>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {message ? (
        <p className="rounded border border-[var(--border)] bg-[var(--bg-surface-2)] px-3 py-2 text-sm">{message}</p>
      ) : null}
      <Card>
        <CardBody className="space-y-4">
          <h1 className="text-lg font-semibold">Domain Permissions</h1>
          <p className="text-sm text-[var(--text-muted)]">
            Configure who can view and review changes for each active domain.
          </p>
          <div className="space-y-3">
            {users.map((u) => (
              <div key={u.user_id} className="rounded border border-[var(--border)] p-3">
                <p className="text-sm font-semibold">{u.name || u.email || u.user_id}</p>
                <p className="mb-2 text-xs text-[var(--text-muted)]">{u.role}</p>
                <div className="grid gap-2 md:grid-cols-2">
                  {domains.map((d) => {
                    const p = getPerm(u.user_id, d.key);
                    const canView = p?.can_view ?? true;
                    const canReview = p?.can_review ?? false;
                    const key = `${u.user_id}:${d.key}`;
                    return (
                      <div key={key} className="rounded border border-[var(--border)] p-2">
                        <p className="text-sm font-medium">{d.name || d.key}</p>
                        <div className="mt-2 flex items-center gap-3">
                          <label className="flex items-center gap-2 text-xs">
                            <Checkbox
                              checked={canView}
                              onCheckedChange={(v) => void save(u.user_id, d.key, Boolean(v), canReview)}
                              disabled={savingKey === key}
                            />
                            View
                          </label>
                          <label className="flex items-center gap-2 text-xs">
                            <Checkbox
                              checked={canReview}
                              onCheckedChange={(v) => void save(u.user_id, d.key, canView, Boolean(v))}
                              disabled={savingKey === key}
                            />
                            Review
                          </label>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
          <Button variant="outline" onClick={() => void load()}>
            Refresh
          </Button>
        </CardBody>
      </Card>
    </div>
  );
}
