"use client";

import { Button, Input, NativeSelect, PageHeader, Card, CardBody } from "@/ui";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

type Row = {
  id: string;
  domain_key: string;
  role_label: string;
  approval_area: string;
  created_at: string;
};

export default function ApprovalRoleMapAdminPage() {
  const [domain, setDomain] = useState("REVENUE");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);

  const [newRole, setNewRole] = useState("");
  const [newArea, setNewArea] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setToast(null);
    try {
      const res = await fetch(
        `/api/admin/approval-role-map?domain=${encodeURIComponent(domain)}`
      );
      const json = await res.json();
      if (!res.ok) throw new Error((json as { error?: string }).error || "Failed");
      setRows((json as { rows?: Row[] }).rows ?? []);
    } catch (e: unknown) {
      setToast(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  }, [domain]);

  useEffect(() => {
    void load();
  }, [load]);

  async function createRow() {
    setToast(null);
    try {
      const res = await fetch(`/api/admin/approval-role-map`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          domain_key: domain,
          role_label: newRole,
          approval_area: newArea,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error((json as { error?: string }).error || "Failed");
      setNewRole("");
      setNewArea("");
      await load();
      setToast("Created mapping.");
    } catch (e: unknown) {
      setToast(e instanceof Error ? e.message : "Failed");
    }
  }

  async function updateRow(id: string, patch: Partial<Row>) {
    setToast(null);
    try {
      const res = await fetch(`/api/admin/approval-role-map/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role_label: patch.role_label,
          approval_area: patch.approval_area,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error((json as { error?: string }).error || "Failed");
      setRows((prev) =>
        prev.map((r) => (r.id === id ? (json as { row?: Row }).row ?? r : r))
      );
      setToast("Saved.");
    } catch (e: unknown) {
      setToast(e instanceof Error ? e.message : "Failed");
    }
  }

  async function deleteRow(id: string) {
    setToast(null);
    try {
      const res = await fetch(`/api/admin/approval-role-map/${id}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!res.ok) throw new Error((json as { error?: string }).error || "Failed");
      setRows((prev) => prev.filter((r) => r.id !== id));
      setToast("Deleted.");
    } catch (e: unknown) {
      setToast(e instanceof Error ? e.message : "Failed");
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Settings", href: "/org/settings" },
          { label: "Approval role map" },
        ]}
        title="Approval Role Map (AI Labels)"
        description="Map AI-required approval labels (e.g., Finance) to internal approval areas (e.g., FINANCE). For trigger-based routing, use Approval Mappings."
        right={
          <div className="flex items-center gap-4">
            <Link href="/settings/approval-mappings" className="text-sm font-semibold text-[var(--primary)] hover:underline">
              Approval mappings →
            </Link>
            <Link href="/org/settings" className="text-sm font-semibold text-[var(--primary)] hover:underline">
              ← Org settings
            </Link>
          </div>
        }
      />

      {toast && (
        <Card className="border-[var(--primary)]/50 bg-[color-mix(in_oklab,var(--primary)_8%,var(--bg-surface))]">
          <CardBody>
            <p className="text-sm text-[var(--text)]">{toast}</p>
          </CardBody>
        </Card>
      )}

      <Card>
        <CardBody>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold">Domain</span>
            <NativeSelect
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
            >
              {["REVENUE", "SECURITY", "DATA", "WORKFLOW"].map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </NativeSelect>
            <Button variant="secondary" size="sm" onClick={load}>
              Refresh
            </Button>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardBody>
          <h2 className="text-sm font-semibold">Add mapping</h2>
          <div className="mt-2 grid gap-2 md:grid-cols-3">
            <Input
              placeholder="role_label (e.g., Finance)"
              value={newRole}
              onChange={(e) => setNewRole(e.target.value)}
            />
            <Input
              placeholder="approval_area (e.g., FINANCE)"
              value={newArea}
              onChange={(e) => setNewArea(e.target.value)}
            />
            <Button
              onClick={createRow}
              disabled={!newRole.trim() || !newArea.trim()}
            >
              Create
            </Button>
          </div>
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
            <div className="mt-3 space-y-3 overflow-x-auto">
              {rows.map((r) => (
                <div
                  key={r.id}
                  className="flex flex-wrap items-center gap-3 border-b border-[var(--border)] pb-3 last:border-b-0"
                >
                  <Input
                    className="min-w-[140px] flex-1"
                    defaultValue={r.role_label}
                    onBlur={(e) =>
                      updateRow(r.id, { role_label: e.target.value })
                    }
                  />
                  <Input
                    className="min-w-[140px] flex-1"
                    defaultValue={r.approval_area}
                    onBlur={(e) =>
                      updateRow(r.id, { approval_area: e.target.value })
                    }
                  />
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => deleteRow(r.id)}
                  >
                    Delete
                  </Button>
                </div>
              ))}
              <p className="text-xs text-[var(--text-muted)]">
                Tip: match the exact strings your AI report emits in requiredApprovals[].
              </p>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
