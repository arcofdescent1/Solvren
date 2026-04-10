"use client";

import { useCallback, useEffect, useState } from "react";
import { Button, Input, Textarea } from "@/ui";

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

function StatusPill({ s }: { s: string }) {
  const cls =
    s === "PROVIDED"
      ? "bg-green-50 border-green-200 text-green-900 dark:bg-green-950/30 dark:border-green-800"
      : s === "WAIVED"
        ? "bg-yellow-50 border-yellow-200 text-yellow-900 dark:bg-yellow-950/30 dark:border-yellow-800"
        : "bg-neutral-50 border-neutral-200 text-neutral-800 dark:bg-neutral-800/50 dark:border-neutral-700";
  return (
    <span
      className={`rounded-full border px-3 py-1 text-xs font-semibold ${cls}`}
    >
      {s}
    </span>
  );
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
        await fetch(`/api/changes/${props.changeId}/evidence/ensure-requirements`, {
          method: "POST",
        });
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

  async function setStatus(
    evidenceId: string,
    status: string,
    note?: string | null,
    url?: string | null
  ) {
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
      setToast(`Marked as ${status.toLowerCase()}.`);
      window.dispatchEvent(new CustomEvent("timeline:refresh"));
    } catch (e: unknown) {
      setToast(e instanceof Error ? e.message : "Failed");
    }
  }

  const provided = items.filter((i) => i.status === "PROVIDED").length;
  const missingRequired = items.filter(
    (i) => i.severity === "REQUIRED" && i.status !== "PROVIDED" && i.status !== "WAIVED"
  ).length;
  const missingRecommended = items.filter(
    (i) => i.severity === "RECOMMENDED" && i.status !== "PROVIDED" && i.status !== "WAIVED"
  ).length;

  return (
    <div
      id="evidence-checklist"
      className="mt-4 rounded-2xl border bg-white dark:bg-[var(--bg-surface)] p-4 scroll-mt-24"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-sm font-semibold">Evidence Checklist</div>
          <div className="text-xs text-[var(--text-muted)]">
            ✓ {provided} provided
            {missingRequired > 0 && (
              <> • ✗ {missingRequired} required missing</>
            )}
            {missingRecommended > 0 && (
              <> • ⚠ {missingRecommended} recommended</>
            )}
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          className="rounded-xl px-3 py-2 text-sm font-semibold"
          onClick={load}
        >
          Refresh
        </Button>
      </div>
      {toast ? (
        <div className="mt-3 text-sm text-[var(--text)]">{toast}</div>
      ) : null}
      {loading ? (
        <div className="mt-3 text-sm text-[var(--text-muted)]">Loading…</div>
      ) : err ? (
        <div className="mt-3 text-sm text-red-600">Error: {err}</div>
      ) : items.length === 0 ? (
        <div className="mt-3 text-sm text-[var(--text-muted)]">
          No evidence items yet. Evidence requirements are generated when you submit for review.
        </div>
      ) : (
        <div className="mt-3 space-y-3">
          {items.map((it) => (
            <div
              key={it.id}
              className={`rounded-xl border p-3 ${
                it.severity === "REQUIRED" && it.status !== "PROVIDED" && it.status !== "WAIVED"
                  ? "border-amber-300 dark:border-amber-700 bg-amber-50/50 dark:bg-amber-950/20"
                  : "border-[var(--border)] bg-[var(--bg-surface)]"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold">{it.label}</span>
                    <span
                      className={`text-xs px-2 py-0.5 rounded ${
                        it.severity === "REQUIRED"
                          ? "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200"
                          : "bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300"
                      }`}
                    >
                      {it.severity}
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-[var(--text-muted)]">{it.kind}</div>
                  {it.status === "PROVIDED" && (it.note || it.url) && (
                    <div className="mt-2 text-xs space-y-1">
                      {it.url && (
                        <a
                          href={it.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[var(--primary)] underline block truncate max-w-full"
                        >
                          {it.url}
                        </a>
                      )}
                      {it.note && (
                        <p className="text-[var(--text-muted)] whitespace-pre-wrap">
                          {it.note}
                        </p>
                      )}
                    </div>
                  )}
                </div>
                <StatusPill s={it.status} />
              </div>

              {providingId === it.id ? (
                <div className="mt-3 space-y-2">
                  <Input
                    className="rounded-lg border px-3 py-2 text-sm w-full"
                    placeholder="URL (optional)"
                    value={provideUrl}
                    onChange={(e) => setProvideUrl(e.target.value)}
                  />
                  <Textarea
                    className="rounded-lg border px-3 py-2 text-sm w-full min-h-20"
                    placeholder="Notes / confirmation (e.g. Validated in staging)"
                    value={provideNote}
                    onChange={(e) => setProvideNote(e.target.value)}
                  />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() =>
                        setStatus(it.id, "PROVIDED", provideNote || null, provideUrl || null)
                      }
                      disabled={!provideNote.trim() && !provideUrl.trim()}
                    >
                      Confirm provided
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setProvidingId(null);
                        setProvideNote("");
                        setProvideUrl("");
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="mt-3 flex flex-wrap gap-2">
                  {it.status !== "PROVIDED" && it.status !== "WAIVED" && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs"
                      onClick={() => {
                        setProvidingId(it.id);
                        setProvideNote(it.note ?? "");
                        setProvideUrl(it.url ?? "");
                      }}
                    >
                      Provide
                    </Button>
                  )}
                  {it.status === "PROVIDED" && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs"
                      onClick={() => setProvidingId(it.id)}
                    >
                      Edit
                    </Button>
                  )}
                  {it.status !== "WAIVED" && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs"
                      onClick={() => setStatus(it.id, "WAIVED")}
                    >
                      Waive
                    </Button>
                  )}
                  {(it.status === "PROVIDED" || it.status === "WAIVED") && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-xs text-[var(--text-muted)]"
                      onClick={() => setStatus(it.id, "MISSING")}
                    >
                      Reset
                    </Button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
