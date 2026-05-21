"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge, Button, Card, CardBody, CardDescription, CardHeader, CardTitle, Input, Textarea } from "@/ui";

type Item = {
  id: string;
  kind: string;
  label: string;
  severity: string;
  status: string;
  note: string | null;
  url: string | null;
  provided_at: string | null;
  created_at: string;
};

function StatusBadge({ status }: { status: string }) {
  if (status === "PROVIDED") return <Badge variant="success">Complete</Badge>;
  if (status === "WAIVED") return <Badge variant="warning">Waived</Badge>;
  return <Badge variant="outline">Needed</Badge>;
}

function SeverityBadge({ severity }: { severity: string }) {
  return severity === "REQUIRED" ? <Badge variant="danger">Required</Badge> : <Badge variant="secondary">Recommended</Badge>;
}

export default function EvidenceChecklist(props: { changeId: string }) {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [providingId, setProvidingId] = useState<string | null>(null);
  const [provideNote, setProvideNote] = useState("");
  const [provideUrl, setProvideUrl] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch(`/api/changes/${props.changeId}/evidence`);
      const json = await res.json();
      if (!res.ok) throw new Error((json as { error?: string }).error || "Failed");
      const list = (json as { items?: Item[] }).items ?? [];
      if (list.length === 0) {
        await fetch(`/api/changes/${props.changeId}/evidence/ensure-requirements`, { method: "POST" });
        const res2 = await fetch(`/api/changes/${props.changeId}/evidence`);
        const json2 = await res2.json();
        setItems((json2 as { items?: Item[] }).items ?? []);
      } else {
        setItems(list);
      }
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  }, [props.changeId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const handler = () => {
      void load();
      document.getElementById("evidence-checklist")?.scrollIntoView({ behavior: "smooth" });
    };
    window.addEventListener("evidence:refresh", handler);
    return () => window.removeEventListener("evidence:refresh", handler);
  }, [load]);

  async function setStatus(evidenceId: string, status: string, note?: string | null, url?: string | null) {
    setToast(null);
    try {
      const body: Record<string, unknown> = { evidenceId, status };
      if (status === "PROVIDED") {
        body.note = note ?? null;
        body.url = url ?? null;
      }
      const res = await fetch(`/api/changes/${props.changeId}/evidence/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error((json as { error?: string }).error || "Failed");
      const updated = json.item as Item | undefined;
      setItems((prev) =>
        prev.map((it) =>
          it.id === evidenceId
            ? { ...it, status, note: updated?.note ?? it.note, url: updated?.url ?? it.url }
            : it
        )
      );
      setProvidingId(null);
      setProvideNote("");
      setProvideUrl("");
      setToast(status === "PROVIDED" ? "Proof marked complete." : status === "WAIVED" ? "Proof waived." : "Proof reset.");
      window.dispatchEvent(new CustomEvent("timeline:refresh"));
    } catch (e: unknown) {
      setToast(e instanceof Error ? e.message : "Failed");
    }
  }

  const provided = items.filter((i) => i.status === "PROVIDED").length;
  const missingRequired = items.filter((i) => i.severity === "REQUIRED" && i.status !== "PROVIDED" && i.status !== "WAIVED").length;
  const missingRecommended = items.filter((i) => i.severity === "RECOMMENDED" && i.status !== "PROVIDED" && i.status !== "WAIVED").length;

  return (
    <Card id="evidence-checklist" className="scroll-mt-28">
      <CardHeader className="flex-row items-start justify-between gap-4">
        <div>
          <CardTitle>Proof checklist</CardTitle>
          <CardDescription>
            Reviewers use this checklist to confirm the change has enough evidence to approve.
          </CardDescription>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={load}>
          Refresh
        </Button>
      </CardHeader>
      <CardBody className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary">{provided} complete</Badge>
          {missingRequired > 0 ? <Badge variant="danger">{missingRequired} required needed</Badge> : null}
          {missingRecommended > 0 ? <Badge variant="outline">{missingRecommended} recommended</Badge> : null}
        </div>

        {toast ? <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-surface-2)] p-3 text-sm">{toast}</div> : null}
        {loading ? <p className="text-sm text-[var(--text-muted)]">Loading proof checklist...</p> : null}
        {err ? <p className="text-sm text-[var(--danger)]">Error: {err}</p> : null}
        {!loading && !err && items.length === 0 ? (
          <div className="rounded-[var(--radius-md)] border border-dashed border-[var(--border)] bg-[var(--bg-surface-2)] p-4 text-sm text-[var(--text-muted)]">
            No proof requirements have been generated yet.
          </div>
        ) : null}

        {!loading && !err && items.length > 0 ? (
          <div className="grid gap-3">
            {items.map((it) => {
              const needsAttention = it.severity === "REQUIRED" && it.status !== "PROVIDED" && it.status !== "WAIVED";
              return (
                <div key={it.id} className={`rounded-[var(--radius-md)] border p-4 ${needsAttention ? "border-amber-300 bg-amber-50/70 dark:border-amber-700 dark:bg-amber-950/20" : "border-[var(--border)] bg-[var(--bg-surface-2)]"}`}>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-sm font-semibold">{it.label}</h3>
                        <SeverityBadge severity={it.severity} />
                      </div>
                      <p className="mt-1 text-xs text-[var(--text-muted)]">{it.kind}</p>
                      {it.status === "PROVIDED" && (it.note || it.url) ? (
                        <div className="mt-2 space-y-1 text-xs">
                          {it.url ? (
                            <a href={it.url} target="_blank" rel="noreferrer" className="block truncate font-medium text-[var(--primary)] hover:underline">
                              {it.url}
                            </a>
                          ) : null}
                          {it.note ? <p className="whitespace-pre-wrap text-[var(--text-muted)]">{it.note}</p> : null}
                        </div>
                      ) : null}
                    </div>
                    <StatusBadge status={it.status} />
                  </div>

                  {providingId === it.id ? (
                    <div className="mt-4 space-y-3">
                      <Input placeholder="Link to proof" value={provideUrl} onChange={(e) => setProvideUrl(e.target.value)} />
                      <Textarea
                        className="min-h-20"
                        placeholder="What should the reviewer know?"
                        value={provideNote}
                        onChange={(e) => setProvideNote(e.target.value)}
                      />
                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" onClick={() => setStatus(it.id, "PROVIDED", provideNote || null, provideUrl || null)} disabled={!provideNote.trim() && !provideUrl.trim()}>
                          Mark complete
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => { setProvidingId(null); setProvideNote(""); setProvideUrl(""); }}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {it.status !== "PROVIDED" && it.status !== "WAIVED" ? (
                        <Button size="sm" variant="outline" onClick={() => { setProvidingId(it.id); setProvideNote(it.note ?? ""); setProvideUrl(it.url ?? ""); }}>
                          Add proof
                        </Button>
                      ) : null}
                      {it.status === "PROVIDED" ? (
                        <Button size="sm" variant="outline" onClick={() => setProvidingId(it.id)}>
                          Edit proof
                        </Button>
                      ) : null}
                      {it.status !== "WAIVED" ? (
                        <Button size="sm" variant="ghost" onClick={() => setStatus(it.id, "WAIVED")}>
                          Waive
                        </Button>
                      ) : null}
                      {it.status === "PROVIDED" || it.status === "WAIVED" ? (
                        <Button size="sm" variant="ghost" onClick={() => setStatus(it.id, "MISSING")}>
                          Reset
                        </Button>
                      ) : null}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : null}
      </CardBody>
    </Card>
  );
}
