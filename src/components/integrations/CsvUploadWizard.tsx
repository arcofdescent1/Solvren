"use client";

/**
 * Phase 3 — CSV upload wizard: upload → preview → mapping → process.
 */
import { useState, useEffect } from "react";
import Link from "next/link";
import { Button, Card, CardBody, Stack } from "@/ui";

type Props = {
  orgId: string;
  onComplete?: () => void;
};

type Step = "upload" | "preview" | "mapping" | "process";

type PreviewData = {
  rows: Record<string, string>[];
  columns: string[];
  rowCount: number;
  errors?: { row: number; message: string }[];
};

type Template = { id: string; name: string; source_object_type: string; canonical_object_type: string };

export default function CsvUploadWizard({ orgId, onComplete }: Props) {
  const [step, setStep] = useState<Step>("upload");
  const [uploadId, setUploadId] = useState<string | null>(null);
  const [objectType, setObjectType] = useState("generic");
  const [uploading, setUploading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [appliedTemplateId, setAppliedTemplateId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [fileInput, setFileInput] = useState<HTMLInputElement | null>(null);

  async function handleUpload() {
    const input = fileInput ?? document.querySelector<HTMLInputElement>('input[type="file"]');
    if (!input?.files?.[0]) {
      setMessage("Select a CSV file");
      return;
    }
    setUploading(true);
    setMessage(null);
    try {
      const form = new FormData();
      form.append("file", input.files[0]);
      const res = await fetch(`/api/integrations/csv/upload?orgId=${encodeURIComponent(orgId)}`, {
        method: "POST",
        body: form,
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json.upload) {
        setUploadId(json.upload.id);
        setStep("preview");
        setPreview(null);
        setMessage(null);
      } else {
        setMessage((json as { error?: string }).error ?? "Upload failed");
      }
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  useEffect(() => {
    if (step === "preview" && uploadId) {
      setLoadingPreview(true);
      fetch(`/api/integrations/csv/uploads/${uploadId}/preview?orgId=${encodeURIComponent(orgId)}&limit=10`)
        .then((r) => r.json())
        .then((j) => {
          if (j.ok) setPreview({ rows: j.rows ?? [], columns: j.columns ?? [], rowCount: j.rowCount ?? 0, errors: j.errors });
          setLoadingPreview(false);
        })
        .catch(() => setLoadingPreview(false));
    }
  }, [step, uploadId, orgId]);

  useEffect(() => {
    if (step === "mapping") {
      setLoadingTemplates(true);
      fetch(`/api/integrations/mapping-templates?orgId=${encodeURIComponent(orgId)}&providerKey=csv&sourceObjectType=${encodeURIComponent(objectType)}`)
        .then((r) => r.json())
        .then((j) => {
          if (j.ok && j.templates) {
            setTemplates(j.templates.map((t: { id: string; name?: string; source_object_type: string; canonical_object_type: string }) => ({
              id: t.id,
              name: t.name ?? t.source_object_type,
              source_object_type: t.source_object_type,
              canonical_object_type: t.canonical_object_type,
            })));
          }
          setLoadingTemplates(false);
        })
        .catch(() => setLoadingTemplates(false));
    }
  }, [step, orgId, objectType]);

  async function handleApplyTemplate(templateId: string) {
    setMessage(null);
    try {
      const res = await fetch(`/api/integrations/mappings/from-template?orgId=${encodeURIComponent(orgId)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ template_id: templateId, provider_key: "csv", source_object_type: objectType }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok) {
        setAppliedTemplateId(templateId);
        setMessage("Mapping template applied. You can refine it in Mappings or proceed to process.");
      } else {
        setMessage((json as { error?: string }).error ?? "Failed to apply template");
      }
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Failed");
    }
  }

  async function handleProcess() {
    if (!uploadId) return;
    setProcessing(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/integrations/csv/uploads/${uploadId}/process`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgId, objectType }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok) {
        const r = json.result as { rowsProcessed?: number; rowsMapped?: number };
        setMessage(`Processed ${r?.rowsProcessed ?? 0} rows, mapped ${r?.rowsMapped ?? 0}`);
        onComplete?.();
      } else {
        setMessage((json as { error?: string }).error ?? "Process failed");
      }
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Process failed");
    } finally {
      setProcessing(false);
    }
  }

  return (
    <Card>
      <CardBody>
        <Stack gap={4}>
          <div className="font-semibold">CSV Import</div>

          {step === "upload" && (
            <>
              <p className="text-sm text-[var(--text-muted)]">Upload a CSV file with a header row.</p>
              <input
                ref={setFileInput}
                type="file"
                accept=".csv,text/csv"
                className="block w-full text-sm"
              />
              <Button onClick={handleUpload} disabled={uploading}>
                {uploading ? "Uploading…" : "Upload"}
              </Button>
            </>
          )}

          {step === "preview" && uploadId && (
            <>
              <p className="text-sm text-[var(--text-muted)]">Preview your data. Check columns and sample rows.</p>
              {loadingPreview
                ? <p className="text-sm text-[var(--text-muted)]">Loading preview…</p>
                : preview
                  ? (
                <div className="overflow-x-auto rounded border border-[var(--border)]">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="border-b border-[var(--border)] bg-[var(--bg-muted)]">
                        {preview.columns.map((c) => (
                          <th key={c} className="px-3 py-2 text-left font-medium">
                            {c}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {preview.rows.slice(0, 10).map((row, i) => (
                        <tr key={i} className="border-b border-[var(--border)]">
                          {preview.columns.map((col) => (
                            <td key={col} className="px-3 py-2">
                              {String(row[col] ?? "")}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                  )
                  : null}
              <p className="text-xs text-[var(--text-muted)]">{preview ? `${preview.rowCount} rows total. Showing first 10.` : ""}</p>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep("upload")}>
                  Back
                </Button>
                <Button onClick={() => setStep("mapping")} disabled={!preview}>
                  Next: Configure mapping
                </Button>
              </div>
            </>
          )}

          {step === "mapping" && uploadId && (
            <>
              <p className="text-sm text-[var(--text-muted)]">Choose canonical object type and optionally apply a mapping template.</p>
              <div>
                <label className="text-xs text-[var(--text-muted)]">Canonical object type</label>
                <select
                  value={objectType}
                  onChange={(e) => {
                    setObjectType(e.target.value);
                    setAppliedTemplateId(null);
                  }}
                  className="mt-1 block w-full rounded border px-3 py-2 text-sm"
                >
                  <option value="generic">Generic</option>
                  <option value="customers">Customers</option>
                  <option value="transactions">Transactions</option>
                  <option value="subscriptions">Subscriptions</option>
                </select>
              </div>
              {loadingTemplates ? (
                <p className="text-sm text-[var(--text-muted)]">Loading templates…</p>
              ) : templates.length > 0 ? (
                <div>
                  <label className="text-xs text-[var(--text-muted)]">Apply mapping template</label>
                  <div className="mt-1 flex flex-wrap gap-2">
                    {templates.map((t) => (
                      <Button
                        key={t.id}
                        variant={appliedTemplateId === t.id ? "default" : "outline"}
                        size="sm"
                        onClick={() => handleApplyTemplate(t.id)}
                      >
                        {t.name}
                      </Button>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-[var(--text-muted)]">No templates for csv/{objectType}. Create a mapping manually.</p>
              )}
              <div className="flex flex-wrap gap-2">
                <Link href={`/integrations/mappings?orgId=${encodeURIComponent(orgId)}`}>
                  <Button variant="outline" size="sm">
                    Open Mappings →
                  </Button>
                </Link>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep("preview")}>
                  Back
                </Button>
                <Button onClick={() => setStep("process")}>
                  Next: Process file
                </Button>
              </div>
            </>
          )}

          {step === "process" && uploadId && (
            <>
              <p className="text-sm text-[var(--text-muted)]">Ready to ingest. Ensure a mapping exists for csv → {objectType}.</p>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep("mapping")}>
                  Back
                </Button>
                <Button onClick={handleProcess} disabled={processing}>
                  {processing ? "Processing…" : "Process file"}
                </Button>
              </div>
            </>
          )}

          {message && <p className="text-sm text-[var(--text-muted)]">{message}</p>}
        </Stack>
      </CardBody>
    </Card>
  );
}
