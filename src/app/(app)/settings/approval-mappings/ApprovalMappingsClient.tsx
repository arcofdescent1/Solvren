"use client";

import { Button, Card, CardBody, Input, NativeSelect, PageHeader, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/ui";
import { Checkbox } from "@/ui/primitives/checkbox";
import Link from "next/link";
import { useEffect, useState } from "react";

type Role = { id: string; role_name: string; enabled: boolean };
type Mapping = {
  id: string;
  trigger_type: "DOMAIN" | "SYSTEM" | "CHANGE_TYPE";
  trigger_value: string;
  approval_role_id: string;
  role_name: string;
  priority: number;
  enabled: boolean;
};

export default function ApprovalMappingsClient() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [rows, setRows] = useState<Mapping[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);

  const [triggerType, setTriggerType] = useState<"DOMAIN" | "SYSTEM" | "CHANGE_TYPE">("DOMAIN");
  const [triggerValue, setTriggerValue] = useState("");
  const [roleId, setRoleId] = useState("");
  const [priority, setPriority] = useState("100");
  const [enabled, setEnabled] = useState(true);

  async function load() {
    setLoading(true);
    setMsg(null);
    try {
      const [roleRes, mapRes] = await Promise.all([
        fetch("/api/settings/approval-roles"),
        fetch("/api/settings/approval-mappings"),
      ]);
      const roleJson = await roleRes.json().catch(() => ({}));
      const mapJson = await mapRes.json().catch(() => ({}));
      if (!roleRes.ok) throw new Error((roleJson as { error?: string }).error ?? "Failed to load roles");
      if (!mapRes.ok) throw new Error((mapJson as { error?: string }).error ?? "Failed to load mappings");
      const loadedRoles = ((roleJson as { rows?: Role[] }).rows ?? []).map((r) => ({
        id: r.id,
        role_name: r.role_name,
        enabled: Boolean((r as { enabled?: boolean }).enabled ?? true),
      }));
      setRoles(loadedRoles);
      setRows((mapJson as { rows?: Mapping[] }).rows ?? []);
      if (!roleId && loadedRoles.length > 0) setRoleId(loadedRoles[0].id);
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function createMapping() {
    setMsg(null);
    const v = triggerValue.trim();
    if (!v || !roleId) return;
    const res = await fetch("/api/settings/approval-mappings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        trigger_type: triggerType,
        trigger_value: v,
        approval_role_id: roleId,
        priority: Number(priority || "100"),
        enabled,
      }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMsg((json as { error?: string }).error ?? "Failed");
      return;
    }
    setTriggerValue("");
    await load();
    setMsg("Mapping created.");
  }

  async function saveMapping(id: string, patch: Partial<Mapping>) {
    setMsg(null);
    const res = await fetch(`/api/settings/approval-mappings/${id}`, {
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

  async function deleteMapping(id: string) {
    setMsg(null);
    const res = await fetch(`/api/settings/approval-mappings/${id}`, {
      method: "DELETE",
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMsg((json as { error?: string }).error ?? "Failed");
      return;
    }
    await load();
    setMsg("Deleted.");
  }

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Settings", href: "/org/settings" },
          { label: "Approval Mappings" },
        ]}
        title="Approval Mappings"
        description="Map Domain/System/Change Type triggers to approval roles."
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
          <h2 className="text-sm font-semibold">Add mapping</h2>
          <div className="grid gap-2 md:grid-cols-5">
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">
                Trigger type
              </label>
              <NativeSelect value={triggerType} onChange={(e) => setTriggerType(e.target.value as "DOMAIN" | "SYSTEM" | "CHANGE_TYPE")}>
                <option value="DOMAIN">Domain</option>
                <option value="SYSTEM">System</option>
                <option value="CHANGE_TYPE">Change Type</option>
              </NativeSelect>
              <span className="mt-0.5 block text-xs text-[var(--text-muted)]">
                Domain, system, or change type
              </span>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">
                Trigger value
              </label>
              <Input
                placeholder={triggerType === "DOMAIN" ? "REVENUE" : triggerType === "SYSTEM" ? "Stripe" : "Pricing"}
                value={triggerValue}
                onChange={(e) => setTriggerValue(e.target.value)}
              />
              <span className="mt-0.5 block text-xs text-[var(--text-muted)]">
                e.g. REVENUE, Stripe
              </span>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">
                Approval role
              </label>
              <NativeSelect value={roleId} onChange={(e) => setRoleId(e.target.value)}>
                {roles.length === 0 ? (
                  <option value="">No roles</option>
                ) : (
                  roles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.role_name}
                    </option>
                  ))
                )}
              </NativeSelect>
              <span className="mt-0.5 block text-xs text-[var(--text-muted)]">
                Role that must approve
              </span>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">
                Priority
              </label>
              <Input
                type="number"
                min={0}
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                placeholder="100"
                title="Higher values are evaluated first when multiple mappings match"
              />
              <span className="mt-0.5 block text-xs text-[var(--text-muted)]">
                Higher = evaluated first
              </span>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">
                Enabled
              </label>
              <div className="flex min-h-10 items-center rounded border border-[var(--border)] px-3">
                <Checkbox checked={enabled} onCheckedChange={(v) => setEnabled(Boolean(v))} />
              </div>
              <span className="mt-0.5 block text-xs text-[var(--text-muted)]">
                Active mapping applies to matches
              </span>
            </div>
          </div>
          <Button onClick={createMapping} disabled={!triggerValue.trim() || !roleId}>
            Create mapping
          </Button>
        </CardBody>
      </Card>

      <Card>
        <CardBody>
          <h2 className="text-sm font-semibold">Mappings</h2>
          {loading ? (
            <p className="mt-3 text-sm text-[var(--text-muted)]">Loading…</p>
          ) : rows.length === 0 ? (
            <p className="mt-3 text-sm text-[var(--text-muted)]">No mappings yet.</p>
          ) : (
            <Table className="mt-3">
              <TableHeader>
                <TableRow>
                  <TableHead>Trigger Type</TableHead>
                  <TableHead>Trigger Value</TableHead>
                  <TableHead>Approver Role</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Enabled</TableHead>
                  <TableHead className="w-[120px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>
                      <NativeSelect
                        defaultValue={r.trigger_type}
                        onChange={(e) =>
                          saveMapping(r.id, { trigger_type: e.target.value as Mapping["trigger_type"] })
                        }
                      >
                        <option value="DOMAIN">Domain</option>
                        <option value="SYSTEM">System</option>
                        <option value="CHANGE_TYPE">Change Type</option>
                      </NativeSelect>
                    </TableCell>
                    <TableCell>
                      <Input
                        defaultValue={r.trigger_value}
                        onBlur={(e) => {
                          const v = e.target.value.trim();
                          if (v && v !== r.trigger_value) saveMapping(r.id, { trigger_value: v });
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <NativeSelect
                        defaultValue={r.approval_role_id}
                        onChange={(e) => saveMapping(r.id, { approval_role_id: e.target.value })}
                      >
                        {roles.map((role) => (
                          <option key={role.id} value={role.id}>
                            {role.role_name}
                          </option>
                        ))}
                      </NativeSelect>
                    </TableCell>
                    <TableCell>
                      <label className="sr-only">Priority</label>
                      <Input
                        type="number"
                        min={0}
                        defaultValue={String(r.priority)}
                        onBlur={(e) => saveMapping(r.id, { priority: Number(e.target.value || "100") })}
                        title="Higher values are evaluated first when multiple mappings match"
                        aria-label="Priority (higher = evaluated first)"
                      />
                    </TableCell>
                    <TableCell>
                      <Checkbox checked={r.enabled} onCheckedChange={(v) => saveMapping(r.id, { enabled: Boolean(v) })} />
                    </TableCell>
                    <TableCell>
                      <Button variant="secondary" size="sm" onClick={() => deleteMapping(r.id)}>
                        Delete
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
