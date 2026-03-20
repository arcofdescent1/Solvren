"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardBody, Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/ui";

type AssumptionMeta = {
  key: string;
  value: number | string | boolean;
  valueType: string;
  source: string;
  effectiveFrom: string | null;
  displayName: string;
};

export function AdminImpactAssumptionsClient() {
  const [assumptions, setAssumptions] = useState<AssumptionMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/admin/impact/assumptions?metadata=true")
      .then((r) => r.json())
      .then((d) => setAssumptions(d.assumptions ?? []))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async (key: string) => {
    setSaving(true);
    try {
      const num = parseFloat(editValue);
      const value = Number.isFinite(num) ? num : editValue;
      const res = await fetch(`/api/admin/impact/assumptions/${encodeURIComponent(key)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value }),
      });
      if (res.ok) {
        setEditing(null);
        const updated = await fetch("/api/admin/impact/assumptions?metadata=true").then((r) => r.json());
        setAssumptions(updated.assumptions ?? []);
      } else {
        const err = await res.json().catch(() => ({}));
        alert((err as { error?: string }).error ?? "Save failed");
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardBody>
          <p className="text-sm text-[var(--text-muted)]">Loading…</p>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card>
      <CardBody className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Assumption</TableHead>
              <TableHead>Value</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Effective from</TableHead>
              <TableHead className="w-24">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {assumptions.map((a) => (
              <TableRow key={a.key}>
                <TableCell>
                  <span className="font-medium">{a.displayName}</span>
                  <span className="ml-1 font-mono text-xs text-[var(--text-muted)]">{a.key}</span>
                </TableCell>
                <TableCell>
                  {editing === a.key ? (
                    <input
                      type={a.valueType === "number" ? "number" : "text"}
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      className="w-32 rounded border border-[var(--border)] bg-[var(--bg)] px-2 py-1 text-sm"
                    />
                  ) : (
                    String(a.value)
                  )}
                </TableCell>
                <TableCell>
                  <span className={a.source === "org_override" ? "text-[var(--primary)]" : "text-[var(--text-muted)]"}>{a.source}</span>
                </TableCell>
                <TableCell className="text-sm text-[var(--text-muted)]">
                  {a.effectiveFrom ? new Date(a.effectiveFrom).toLocaleDateString() : "—"}
                </TableCell>
                <TableCell>
                  {editing === a.key ? (
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => handleSave(a.key)}
                        disabled={saving}
                        className="text-xs font-medium text-[var(--primary)] hover:underline disabled:opacity-50"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() => { setEditing(null); setEditValue(""); }}
                        className="text-xs font-medium text-[var(--text-muted)] hover:underline"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => { setEditing(a.key); setEditValue(String(a.value)); }}
                        className="text-xs font-medium text-[var(--primary)] hover:underline"
                      >
                        Override
                      </button>
                      <Link href={`/admin/impact/assumptions/${a.key}/history`} className="text-xs font-medium text-[var(--text-muted)] hover:underline">
                        History
                      </Link>
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardBody>
    </Card>
  );
}
