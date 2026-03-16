"use client";

import { useState, useEffect, useCallback } from "react";
import { Button, Input, NativeSelect } from "@/ui";

const MAPPING_TYPES = ["group", "claim", "email_domain", "default"] as const;
const TARGET_ROLES = ["owner", "admin", "submitter", "reviewer", "approver", "viewer"] as const;

export type RoleMappingRow = {
  id?: string;
  mappingType: string;
  sourceKey: string | null;
  sourceValue: string | null;
  targetRole: string;
  priority: number;
};

type Props = {
  orgId: string;
  providerId: string;
};

export default function SsoRoleMappingsEditor({ orgId, providerId }: Props) {
  const [mappings, setMappings] = useState<RoleMappingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/org/settings/sso/role-mappings?organizationId=${encodeURIComponent(orgId)}&providerId=${encodeURIComponent(providerId)}`
      );
      const json = await res.json().catch(() => ({}));
      if (res.ok && Array.isArray((json as { mappings?: RoleMappingRow[] }).mappings)) {
        setMappings(
          (json as { mappings: RoleMappingRow[] }).mappings.map((m) => ({
            id: m.id,
            mappingType: m.mappingType ?? "group",
            sourceKey: m.sourceKey ?? null,
            sourceValue: m.sourceValue ?? null,
            targetRole: m.targetRole ?? "viewer",
            priority: typeof m.priority === "number" ? m.priority : 100,
          }))
        );
      } else {
        setMappings([]);
      }
    } finally {
      setLoading(false);
    }
  }, [orgId, providerId]);

  useEffect(() => {
    load();
  }, [load]);

  function addRow() {
    setMappings((prev) => [
      ...prev,
      { mappingType: "group", sourceKey: "", sourceValue: "", targetRole: "viewer", priority: 100 },
    ]);
  }

  function updateRow(index: number, patch: Partial<RoleMappingRow>) {
    setMappings((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], ...patch };
      return next;
    });
  }

  function removeRow(index: number) {
    setMappings((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch("/api/org/settings/sso/role-mappings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId: orgId,
          providerId,
          mappings: mappings.map((m) => ({
            mappingType: m.mappingType,
            sourceKey: m.sourceKey || null,
            sourceValue: m.sourceValue || null,
            targetRole: m.targetRole,
            priority: m.priority,
          })),
        }),
      });
      if (res.ok) await load();
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="text-sm text-[var(--text-muted)]">Loading role mappings…</p>;

  return (
    <div className="space-y-3 rounded border p-4">
      <div className="flex items-center justify-between">
        <h4 className="font-medium">Role mappings</h4>
        <Button variant="outline" size="sm" onClick={addRow}>
          Add mapping
        </Button>
      </div>
      <p className="text-xs text-[var(--text-muted)]">
        Map IdP groups, claims, or email domains to organization roles. Lower priority number is evaluated first.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left">
              <th className="pb-2 pr-2">Type</th>
              <th className="pb-2 pr-2">Source key</th>
              <th className="pb-2 pr-2">Source value</th>
              <th className="pb-2 pr-2">Role</th>
              <th className="pb-2 pr-2">Priority</th>
              <th className="pb-2 w-10" />
            </tr>
          </thead>
          <tbody>
            {mappings.map((row, i) => (
              <tr key={i} className="border-b">
                <td className="py-1 pr-2">
                  <NativeSelect
                    value={row.mappingType}
                    onChange={(e) => updateRow(i, { mappingType: e.target.value })}
                  >
                    {MAPPING_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </NativeSelect>
                </td>
                <td className="py-1 pr-2">
                  <Input
                    value={row.sourceKey ?? ""}
                    onChange={(e) => updateRow(i, { sourceKey: e.target.value || null })}
                    placeholder="e.g. group"
                    className="min-w-[100px]"
                  />
                </td>
                <td className="py-1 pr-2">
                  <Input
                    value={row.sourceValue ?? ""}
                    onChange={(e) => updateRow(i, { sourceValue: e.target.value || null })}
                    placeholder="e.g. Finance"
                    className="min-w-[100px]"
                  />
                </td>
                <td className="py-1 pr-2">
                  <NativeSelect
                    value={row.targetRole}
                    onChange={(e) => updateRow(i, { targetRole: e.target.value })}
                  >
                    {TARGET_ROLES.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </NativeSelect>
                </td>
                <td className="py-1 pr-2">
                  <Input
                    type="number"
                    value={row.priority}
                    onChange={(e) => updateRow(i, { priority: parseInt(e.target.value, 10) || 100 })}
                    className="w-16"
                  />
                </td>
                <td className="py-1">
                  <Button variant="ghost" size="sm" onClick={() => removeRow(i)}>
                    Remove
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {mappings.length === 0 && (
        <p className="text-sm text-[var(--text-muted)]">No mappings. Default role will be used (e.g. viewer).</p>
      )}
      <Button onClick={handleSave} disabled={saving} size="sm">
        {saving ? "Saving…" : "Save role mappings"}
      </Button>
    </div>
  );
}
