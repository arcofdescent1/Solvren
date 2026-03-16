"use client";

import { Button, Card, CardBody, Input, PageHeader, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/ui";
import { Checkbox } from "@/ui/primitives/checkbox";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type OrgMember = {
  user_id: string;
  email: string | null;
  name: string | null;
};

type RoleRow = {
  id: string;
  role_name: string;
  description: string | null;
  enabled: boolean;
  members: Array<{ user_id: string; email: string | null; name: string | null }>;
};

export default function ApprovalRolesClient({ orgId }: { orgId: string }) {
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);

  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");

  const memberById = useMemo(() => {
    const map = new Map<string, OrgMember>();
    for (const m of members) map.set(m.user_id, m);
    return map;
  }, [members]);

  async function load() {
    setLoading(true);
    setMsg(null);
    try {
      const [roleRes, memberRes] = await Promise.all([
        fetch("/api/settings/approval-roles"),
        fetch(`/api/org/members?orgId=${encodeURIComponent(orgId)}`),
      ]);
      const roleJson = await roleRes.json().catch(() => ({}));
      const memberJson = await memberRes.json().catch(() => ({}));
      if (!roleRes.ok) throw new Error((roleJson as { error?: string }).error ?? "Failed to load roles");
      if (!memberRes.ok) throw new Error((memberJson as { error?: string }).error ?? "Failed to load members");
      setRoles((roleJson as { rows?: RoleRow[] }).rows ?? []);
      setMembers(((memberJson as { members?: OrgMember[] }).members ?? []).map((m) => ({
        user_id: m.user_id,
        email: m.email ?? null,
        name: m.name ?? null,
      })));
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function createRole() {
    setMsg(null);
    const roleName = newName.trim();
    if (!roleName) return;
    const res = await fetch("/api/settings/approval-roles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role_name: roleName, description: newDesc.trim() || null }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMsg((json as { error?: string }).error ?? "Failed");
      return;
    }
    setNewName("");
    setNewDesc("");
    await load();
    setMsg("Role created.");
  }

  async function saveRole(
    roleId: string,
    patch: {
      role_name?: string;
      description?: string | null;
      enabled?: boolean;
      member_user_ids?: string[];
    }
  ) {
    setMsg(null);
    const res = await fetch(`/api/settings/approval-roles/${roleId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMsg((json as { error?: string }).error ?? "Failed");
      return;
    }
    await load();
    setMsg("Saved.");
  }

  async function removeRole(roleId: string) {
    setMsg(null);
    const res = await fetch(`/api/settings/approval-roles/${roleId}`, {
      method: "DELETE",
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMsg((json as { error?: string }).error ?? "Failed");
      return;
    }
    await load();
    setMsg("Role deleted.");
  }

  function toggleMember(role: RoleRow, userId: string) {
    const set = new Set(role.members.map((m) => m.user_id));
    if (set.has(userId)) set.delete(userId);
    else set.add(userId);
    saveRole(role.id, { member_user_ids: [...set] });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Settings", href: "/org/settings" },
          { label: "Approval roles" },
        ]}
        title="Approval Roles"
        description="Create approval roles and assign users to each role."
        right={
          <Link href="/org/settings" className="text-sm font-semibold text-[var(--primary)] hover:underline">
            ← Org settings
          </Link>
        }
      />

      {msg ? (
        <Card>
          <CardBody>
            <p className="text-sm text-[var(--text)]">{msg}</p>
          </CardBody>
        </Card>
      ) : null}

      <Card>
        <CardBody className="space-y-3">
          <h2 className="text-sm font-semibold">Create role</h2>
          <div className="grid gap-2 md:grid-cols-3">
            <Input
              placeholder="Role name (e.g., FINANCE_REVIEWER)"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
            <Input
              placeholder="Description (optional)"
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
            />
            <Button onClick={createRole} disabled={!newName.trim()}>
              Create role
            </Button>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardBody>
          <h2 className="text-sm font-semibold">Roles & members</h2>
          {loading ? (
            <p className="mt-3 text-sm text-[var(--text-muted)]">Loading…</p>
          ) : roles.length === 0 ? (
            <p className="mt-3 text-sm text-[var(--text-muted)]">No approval roles yet.</p>
          ) : (
            <Table className="mt-3">
              <TableHeader>
                <TableRow>
                  <TableHead>Role</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Enabled</TableHead>
                  <TableHead>Members</TableHead>
                  <TableHead className="w-[120px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {roles.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>
                      <Input
                        defaultValue={r.role_name}
                        onBlur={(e) => {
                          const v = e.target.value.trim();
                          if (v && v !== r.role_name) saveRole(r.id, { role_name: v });
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        defaultValue={r.description ?? ""}
                        onBlur={(e) => {
                          const v = e.target.value.trim();
                          if ((r.description ?? "") !== v) saveRole(r.id, { description: v || null });
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <Checkbox
                        checked={Boolean(r.enabled)}
                        onCheckedChange={(v) => saveRole(r.id, { enabled: Boolean(v) })}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="max-h-36 space-y-1 overflow-auto rounded border border-[var(--border)] p-2">
                        {members.map((m) => {
                          const checked = r.members.some((x) => x.user_id === m.user_id);
                          return (
                            <label key={m.user_id} className="flex items-center gap-2 text-xs">
                              <Checkbox
                                checked={checked}
                                onCheckedChange={() => toggleMember(r, m.user_id)}
                              />
                              <span>
                                {m.name || m.email || m.user_id}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Button variant="secondary" size="sm" onClick={() => removeRole(r.id)}>
                        Delete
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {!loading && roles.some((r) => r.members.length === 0) && (
            <p className="mt-3 text-xs text-[var(--warning)]">
              Warning: one or more roles have no members and will not produce approver suggestions.
            </p>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
