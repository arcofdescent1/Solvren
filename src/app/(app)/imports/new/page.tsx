"use client";

import { Button, Input, NativeSelect, PageHeader, Card, CardBody } from "@/ui";
import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import type { MappingConfigV1 } from "@/lib/imports/mappingConfig";

type PreviewResponse = {
  ok?: boolean;
  previewToken?: string;
  previewExpiresAt?: string;
  columns?: string[];
  sampleRows?: Record<string, string>[];
  suggestedMapping?: MappingConfigV1;
  sheetNames?: string[] | null;
  rowCount?: number;
  warnings?: { code: string; message: string }[];
  error?: string;
};

export default function SpreadsheetImportPage() {
  const supabase = createClient();
  const router = useRouter();

  const [orgs, setOrgs] = useState<{ id: string; name: string }[]>([]);
  const [orgId, setOrgId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [sheetIndex, setSheetIndex] = useState(0);
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [mappingJson, setMappingJson] = useState("");
  const [defaultIntakeType, setDefaultIntakeType] = useState("CHANGE_REQUEST");
  const [submitMode, setSubmitMode] = useState<"DRAFT" | "ACTIVE">("DRAFT");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [batchStatus, setBatchStatus] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: userRes } = await supabase.auth.getUser();
      if (!userRes.user) {
        router.push("/login");
        return;
      }
      const { data: memberships, error } = await supabase
        .from("organization_members")
        .select("org_id, organizations(id, name)");
      if (error) {
        setMsg(error.message);
        return;
      }
      type MemberRow = {
        org_id: string;
        organizations: { id: string; name: string } | { id: string; name: string }[] | null;
      };
      const mapped = (memberships || []).flatMap((m) => {
        const org = (m as MemberRow).organizations;
        if (!org) return [];
        return Array.isArray(org) ? org : [org];
      });
      setOrgs(mapped);
      if (mapped.length > 0) setOrgId(mapped[0].id);
      if (mapped.length === 0) router.push("/onboarding");
    })();
  }, [router, supabase]);

  const runPreview = async () => {
    setMsg(null);
    setPreview(null);
    if (!orgId || !file) {
      setMsg("Select an organization and file.");
      return;
    }
    setLoading(true);
    try {
      const fd = new FormData();
      fd.set("orgId", orgId);
      fd.set("file", file);
      fd.set("sheetIndex", String(sheetIndex));
      const res = await fetch(`/api/imports/spreadsheet/preview?orgId=${encodeURIComponent(orgId)}`, {
        method: "POST",
        body: fd,
      });
      const json = (await res.json()) as PreviewResponse;
      if (!res.ok) throw new Error(json.error ?? "Preview failed");
      setPreview(json);
      const sm = json.suggestedMapping ?? { version: 1, mappings: {} };
      setMappingJson(JSON.stringify(sm, null, 2));
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Preview failed");
    } finally {
      setLoading(false);
    }
  };

  const pollProcess = useCallback(
    async (batchId: string) => {
      let done = false;
      while (!done) {
        const proc = await fetch(
          `/api/imports/${batchId}/process?orgId=${encodeURIComponent(orgId)}`,
          { method: "POST" }
        );
        const j = await proc.json().catch(() => ({}));
        if (!proc.ok) {
          setMsg((j as { error?: string }).error ?? "Processing failed");
          return;
        }
        const st = (j as { status?: string; done?: boolean }).status ?? "";
        setBatchStatus(st);
        done = Boolean((j as { done?: boolean }).done);
        if (!done) await new Promise((r) => setTimeout(r, 1500));
      }
      setMsg("Import finished. Review changes in the queue.");
    },
    [orgId]
  );

  const runCommit = async () => {
    setMsg(null);
    setBatchStatus(null);
    if (!preview?.previewToken) {
      setMsg("Run preview first.");
      return;
    }
    let mapping: MappingConfigV1;
    try {
      mapping = JSON.parse(mappingJson) as MappingConfigV1;
    } catch {
      setMsg("Mapping JSON is invalid.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/imports/spreadsheet/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orgId,
          previewToken: preview.previewToken,
          submitMode,
          defaultIntakeRecordType: defaultIntakeType,
          sheetIndex,
          mapping,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((json as { error?: string }).error ?? "Commit failed");

      if ((json as { queued?: boolean }).queued && (json as { batchId?: string }).batchId) {
        setBatchStatus("QUEUED");
        await pollProcess((json as { batchId: string }).batchId);
      } else {
        setMsg(
          `Import complete: ${(json as { importedRows?: number }).importedRows ?? 0} imported, ${(json as { failedRows?: number }).failedRows ?? 0} failed.`
        );
      }
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Commit failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={[
          { label: "Overview", href: "/dashboard" },
          { label: "Imports", href: "/imports/new" },
        ]}
        title="Spreadsheet import"
        description="Upload a .csv or .xlsx file (max 10 MB, 5,000 rows, 100 columns). Preview is valid for 24 hours."
      />

      <Card>
        <CardBody className="space-y-4">
          {orgs.length > 1 && (
            <label className="block space-y-1 text-sm">
              <span>Organization</span>
              <NativeSelect value={orgId} onChange={(e) => setOrgId(e.target.value)}>
                {orgs.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </NativeSelect>
            </label>
          )}
          <label className="block space-y-1 text-sm">
            <span>File (.csv or .xlsx)</span>
            <Input
              type="file"
              accept=".csv,.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </label>
          {file?.name.toLowerCase().endsWith(".xlsx") && (
            <label className="block space-y-1 text-sm">
              <span>Sheet index (0 = first sheet; re-run preview after changing)</span>
              <Input
                type="number"
                min={0}
                value={sheetIndex}
                onChange={(e) => setSheetIndex(Math.max(0, Number(e.target.value) || 0))}
              />
            </label>
          )}
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={runPreview} disabled={loading || !orgId}>
              {loading ? "Working…" : "Preview"}
            </Button>
          </div>
          {preview?.rowCount != null && (
            <p className="text-sm text-[var(--text-muted)]">
              {preview.rowCount} data rows detected
              {preview.previewExpiresAt
                ? ` · preview expires ${new Date(preview.previewExpiresAt).toLocaleString()}`
                : ""}
            </p>
          )}
          {preview?.warnings && preview.warnings.length > 0 && (
            <ul className="list-disc pl-5 text-sm text-amber-800 dark:text-amber-200">
              {preview.warnings.map((w) => (
                <li key={w.code + w.message}>{w.message}</li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      {preview?.columns && (
        <Card>
          <CardBody className="space-y-3">
            <div className="font-semibold">Columns</div>
            <p className="text-xs text-[var(--text-muted)]">{preview.columns.join(", ")}</p>
            <div className="font-semibold">Mapping (JSON)</div>
            <p className="text-xs text-[var(--text-muted)]">
              Map canonical fields to your column names: title, description, severity. Optional recordTypeField
              and recordTypeMap per Phase 3 spec.
            </p>
            <textarea
              className="min-h-[200px] w-full rounded-md border border-[var(--border)] bg-[var(--bg)] p-2 font-mono text-xs"
              value={mappingJson}
              onChange={(e) => setMappingJson(e.target.value)}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block space-y-1 text-sm">
                <span>Default record type</span>
                <NativeSelect value={defaultIntakeType} onChange={(e) => setDefaultIntakeType(e.target.value)}>
                  <option value="CHANGE_REQUEST">Change request</option>
                  <option value="OPERATIONAL_RISK">Operational risk</option>
                  <option value="READINESS_CONCERN">Readiness concern</option>
                  <option value="DEPLOYMENT_BLOCKER">Deployment blocker</option>
                  <option value="OTHER">Other</option>
                </NativeSelect>
              </label>
              <label className="block space-y-1 text-sm">
                <span>Submit mode</span>
                <NativeSelect
                  value={submitMode}
                  onChange={(e) => setSubmitMode(e.target.value as "DRAFT" | "ACTIVE")}
                >
                  <option value="DRAFT">Create drafts</option>
                  <option value="ACTIVE">Submit each row for review</option>
                </NativeSelect>
              </label>
            </div>
            <Button type="button" onClick={runCommit} disabled={loading}>
              Commit import
            </Button>
            {batchStatus && (
              <p className="text-sm text-[var(--text-muted)]">Batch status: {batchStatus}</p>
            )}
          </CardBody>
        </Card>
      )}

      {msg && <p className="text-sm text-[var(--text-muted)]">{msg}</p>}
    </div>
  );
}
