"use client";

import * as React from "react";
import { Button, Card, CardBody, NativeSelect } from "@/ui";

type Grant = {
  id: string;
  user_id: string;
  access_type: string;
  created_at: string;
};

type Member = {
  user_id: string;
  role: string;
  email: string | null;
  name: string | null;
};

export default function RestrictedAccessPanel({
  changeId,
  isRestricted,
}: {
  changeId: string;
  isRestricted: boolean;
}) {
  const [loading, setLoading] = React.useState(true);
  const [canManage, setCanManage] = React.useState(false);
  const [members, setMembers] = React.useState<Member[]>([]);
  const [grants, setGrants] = React.useState<Grant[]>([]);
  const [selectedUserId, setSelectedUserId] = React.useState("");
  const [restricted, setRestricted] = React.useState(isRestricted);
  const [busy, setBusy] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/changes/${encodeURIComponent(changeId)}/permissions`);
      const json = (await res.json()) as {
        canManage?: boolean;
        members?: Member[];
        grants?: Grant[];
      };
      if (!res.ok) {
        setCanManage(false);
        setMembers([]);
        setGrants([]);
      } else {
        setCanManage(Boolean(json.canManage));
        setMembers(json.members ?? []);
        setGrants(json.grants ?? []);
        if (!selectedUserId && (json.members?.length ?? 0) > 0) {
          setSelectedUserId(json.members?.[0]?.user_id ?? "");
        }
      }
    } finally {
      setLoading(false);
    }
  }, [changeId, selectedUserId]);

  React.useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <Card>
        <CardBody>
          <p className="text-sm text-[var(--text-muted)]">Loading access controls…</p>
        </CardBody>
      </Card>
    );
  }

  if (!canManage) return null;

  const grantedUserIds = new Set(grants.map((g) => g.user_id));
  const grantable = members.filter((m) => !grantedUserIds.has(m.user_id));

  async function onToggleRestricted(next: boolean) {
    setBusy(true);
    setMessage(null);
    const res = await fetch(`/api/changes/${encodeURIComponent(changeId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isRestricted: next }),
    });
    setBusy(false);
    if (!res.ok) {
      setMessage("Failed to update restricted visibility.");
      return;
    }
    setRestricted(next);
    setMessage(next ? "Change marked restricted." : "Restricted mode removed.");
  }

  async function onGrant() {
    if (!selectedUserId) return;
    setBusy(true);
    setMessage(null);
    const res = await fetch(`/api/changes/${encodeURIComponent(changeId)}/permissions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: selectedUserId, accessType: "VIEW" }),
    });
    setBusy(false);
    if (!res.ok) {
      setMessage("Failed to grant access.");
      return;
    }
    setMessage("Restricted access granted.");
    await load();
  }

  async function onRevoke(grantId: string) {
    setBusy(true);
    setMessage(null);
    const res = await fetch(
      `/api/changes/${encodeURIComponent(changeId)}/permissions?grantId=${encodeURIComponent(grantId)}`,
      { method: "DELETE" }
    );
    setBusy(false);
    if (!res.ok) {
      setMessage("Failed to revoke access.");
      return;
    }
    setMessage("Restricted access revoked.");
    await load();
  }

  return (
    <Card>
      <CardBody className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-semibold">Restricted Access</h2>
          <div className="flex gap-2">
            <Button
              variant={restricted ? "secondary" : "outline"}
              disabled={busy || restricted}
              onClick={() => void onToggleRestricted(true)}
            >
              Mark Restricted
            </Button>
            <Button
              variant="outline"
              disabled={busy || !restricted}
              onClick={() => void onToggleRestricted(false)}
            >
              Mark Standard
            </Button>
          </div>
        </div>
        {message ? <p className="text-xs text-[var(--text-muted)]">{message}</p> : null}
        <p className="text-sm text-[var(--text-muted)]">
          Restricted changes are visible only to owner/admin, creator, assigned approvers, and explicit grants.
        </p>

        <div className="flex flex-wrap items-center gap-2">
          <NativeSelect
            value={selectedUserId}
            onChange={(e) => setSelectedUserId(e.target.value)}
            disabled={busy || grantable.length === 0}
          >
            {grantable.map((m) => (
              <option key={m.user_id} value={m.user_id}>
                {(m.name || m.email || m.user_id) + ` (${m.role})`}
              </option>
            ))}
          </NativeSelect>
          <Button disabled={busy || !selectedUserId || grantable.length === 0} onClick={() => void onGrant()}>
            Grant View Access
          </Button>
        </div>

        {grants.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)]">No explicit grants.</p>
        ) : (
          <div className="space-y-2">
            {grants.map((g) => {
              const member = members.find((m) => m.user_id === g.user_id);
              const label = member?.name || member?.email || g.user_id;
              return (
                <div
                  key={g.id}
                  className="flex items-center justify-between rounded border border-[var(--border)] px-3 py-2 text-sm"
                >
                  <span>{label}</span>
                  <Button variant="outline" size="sm" disabled={busy} onClick={() => void onRevoke(g.id)}>
                    Revoke
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </CardBody>
    </Card>
  );
}
