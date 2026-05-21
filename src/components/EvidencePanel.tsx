"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  NativeSelect,
  Textarea,
} from "@/ui";
import {
  EVIDENCE_KIND_LABEL,
  type EvidenceKind,
  type RiskBucket,
} from "@/services/risk/requirements";

type EvidenceRow = {
  id: string;
  kind: string;
  label: string;
  url: string | null;
  note: string | null;
  created_at: string;
};

type Suggestion = {
  kind: string;
  suggested_label: string;
  what_good_looks_like?: string[];
  example_links?: string[];
  checklist_items?: string[];
  suggested_url_types?: string[];
};

export default function EvidencePanel({
  changeEventId,
  orgId,
  riskBucket,
  requiredEvidenceKinds,
  requiredEvidenceKindsOverride,
  evidence,
  missingEvidenceSuggestions,
}: {
  changeEventId: string;
  orgId: string;
  riskBucket: RiskBucket | null;
  requiredEvidenceKinds: EvidenceKind[];
  requiredEvidenceKindsOverride?: EvidenceKind[] | null;
  evidence: EvidenceRow[];
  missingEvidenceSuggestions?: {
    version?: string;
    missing_kinds?: string[];
    suggestions?: Suggestion[];
  } | null;
}) {
  const router = useRouter();
  const [kind, setKind] = useState<EvidenceKind>("PR");
  const [label, setLabel] = useState("");
  const [url, setUrl] = useState("");
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [suggestLoading, setSuggestLoading] = useState(false);

  const evidenceKindsPresent = useMemo(() => new Set((evidence ?? []).map((e) => e.kind)), [evidence]);
  const requiredKinds = useMemo(() => (requiredEvidenceKindsOverride ?? requiredEvidenceKinds) ?? [], [requiredEvidenceKindsOverride, requiredEvidenceKinds]);
  const missingRequired = useMemo(() => requiredKinds.filter((k) => !evidenceKindsPresent.has(k)), [requiredKinds, evidenceKindsPresent]);
  const suggestions = (missingEvidenceSuggestions?.suggestions ?? []) as Suggestion[];

  async function addEvidence(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setLoading(true);

    const resp = await fetch("/api/evidence/add", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        changeEventId,
        kind,
        label: label || EVIDENCE_KIND_LABEL[kind],
        url: url || null,
        note: note || null,
      }),
    });

    const json = await resp.json().catch(() => ({}));
    setLoading(false);

    if (!resp.ok) {
      setMsg(json?.error ?? "Proof could not be added.");
      return;
    }

    setKind("PR");
    setLabel("");
    setUrl("");
    setNote("");
    setMsg("Proof added.");
    router.refresh();
    window.dispatchEvent(new CustomEvent("timeline:refresh"));
  }

  async function suggestEvidence() {
    if (missingRequired.length === 0) return;
    setMsg(null);
    setSuggestLoading(true);

    const resp = await fetch("/api/ai/suggest-evidence", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ changeEventId }),
    });

    const json = await resp.json().catch(() => ({}));
    setSuggestLoading(false);

    if (!resp.ok) {
      setMsg((json as { error?: string })?.error ?? "Proof suggestions could not be generated.");
      return;
    }

    setMsg("Proof suggestions refreshed.");
    router.refresh();
  }

  function applySuggestion(s: Suggestion) {
    const items = s.what_good_looks_like ?? s.checklist_items ?? [];
    const links = s.example_links ?? s.suggested_url_types ?? [];
    const firstUrl = links.find((x) => /^https?:\/\//i.test(x));

    setKind(s.kind as EvidenceKind);
    setLabel(s.suggested_label);
    setUrl(firstUrl ?? "");
    setNote(items.length > 0 ? items.map((x) => `- ${x}`).join("\n") : "");
  }

  return (
    <Card id="evidence-panel">
      <CardHeader className="flex-row items-start justify-between gap-4">
        <div>
          <CardTitle>Proof record</CardTitle>
          <CardDescription>
            Attach the links, test results, and notes a reviewer needs before approving this change.
          </CardDescription>
        </div>
        {riskBucket ? <Badge variant="outline">{requiredKinds.length} required</Badge> : null}
      </CardHeader>

      <CardBody className="space-y-5">
        {riskBucket ? (
          <section className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--bg-surface-2)] p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <h3 className="text-sm font-semibold">Proof needed for approval</h3>
                <p className="mt-1 text-sm text-[var(--text-muted)]">
                  Solvren keeps high-risk changes from moving forward until the right evidence is attached.
                </p>
              </div>
              {missingRequired.length > 0 ? (
                <Button type="button" onClick={suggestEvidence} disabled={suggestLoading} variant="secondary" size="sm">
                  {suggestLoading ? "Finding proof..." : suggestions.length > 0 ? "Refresh suggestions" : "Suggest proof"}
                </Button>
              ) : null}
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {requiredKinds.length === 0 ? (
                <Badge variant="success">No proof required</Badge>
              ) : (
                requiredKinds.map((k) => {
                  const ok = evidenceKindsPresent.has(k);
                  return (
                    <Badge key={k} variant={ok ? "success" : "outline"}>
                      {EVIDENCE_KIND_LABEL[k]} {ok ? "complete" : "needed"}
                    </Badge>
                  );
                })
              )}
            </div>

            {missingRequired.length > 0 ? (
              <p className="mt-3 text-sm text-[var(--text-muted)]">
                Still needed: {missingRequired.map((k) => EVIDENCE_KIND_LABEL[k]).join(", ")}
              </p>
            ) : null}

            {suggestions.length > 0 ? (
              <div className="mt-4 grid gap-3 lg:grid-cols-2">
                {suggestions.map((s, idx) => {
                  const items = s.what_good_looks_like ?? s.checklist_items ?? [];
                  const links = s.example_links ?? s.suggested_url_types ?? [];
                  return (
                    <div key={idx} className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-surface)] p-3 text-sm">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="font-semibold">{EVIDENCE_KIND_LABEL[s.kind as EvidenceKind]}</div>
                          <p className="mt-1 text-[var(--text-muted)]">{s.suggested_label}</p>
                        </div>
                        <Button type="button" variant="outline" size="sm" onClick={() => applySuggestion(s)}>
                          Use
                        </Button>
                      </div>
                      {items.length > 0 ? (
                        <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-[var(--text-muted)]">
                          {items.map((item, i) => <li key={i}>{item}</li>)}
                        </ul>
                      ) : null}
                      {links.length > 0 ? <p className="mt-2 text-xs text-[var(--text-muted)]">Examples: {links.join(", ")}</p> : null}
                    </div>
                  );
                })}
              </div>
            ) : null}
          </section>
        ) : null}

        <form onSubmit={addEvidence} className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--bg-surface)] p-4">
          <div>
            <h3 className="text-sm font-semibold">Attach proof</h3>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              Add a link or note that helps reviewers understand why this change is safe.
            </p>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="space-y-1 text-sm font-medium">
              Proof type
              <NativeSelect value={kind} onChange={(e) => setKind(e.target.value as EvidenceKind)}>
                {Object.keys(EVIDENCE_KIND_LABEL).map((k) => (
                  <option key={k} value={k}>{EVIDENCE_KIND_LABEL[k as EvidenceKind]}</option>
                ))}
              </NativeSelect>
            </label>

            <label className="space-y-1 text-sm font-medium">
              Label
              <Input placeholder="e.g. Stripe annual plan PR" value={label} onChange={(e) => setLabel(e.target.value)} />
            </label>
          </div>

          <label className="mt-3 block space-y-1 text-sm font-medium">
            Link
            <Input placeholder="https://github.com/org/repo/pull/123" value={url} onChange={(e) => setUrl(e.target.value)} />
          </label>

          <label className="mt-3 block space-y-1 text-sm font-medium">
            Reviewer note
            <Textarea
              className="min-h-24"
              placeholder="What does this prove? What should the reviewer look for?"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </label>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <Button disabled={loading || !orgId}>{loading ? "Adding..." : "Add proof"}</Button>
            {msg ? <span className="text-sm text-[var(--text-muted)]">{msg}</span> : null}
          </div>
        </form>

        <section className="space-y-2">
          <h3 className="text-sm font-semibold">Attached proof</h3>
          {!evidence || evidence.length === 0 ? (
            <div className="rounded-[var(--radius-md)] border border-dashed border-[var(--border)] bg-[var(--bg-surface-2)] p-4 text-sm text-[var(--text-muted)]">
              No proof has been attached yet.
            </div>
          ) : (
            <div className="grid gap-2">
              {evidence.map((ev) => (
                <div key={ev.id} className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-surface-2)] p-3 text-sm">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold">{ev.label}</div>
                      <div className="mt-1 text-xs text-[var(--text-muted)]">{EVIDENCE_KIND_LABEL[ev.kind as EvidenceKind] ?? ev.kind}</div>
                    </div>
                    <time className="text-xs text-[var(--text-muted)]">{new Date(ev.created_at).toLocaleString()}</time>
                  </div>
                  {ev.url ? (
                    <a className="mt-2 block truncate text-xs font-medium text-[var(--primary)] hover:underline" href={ev.url} target="_blank" rel="noreferrer">
                      {ev.url}
                    </a>
                  ) : null}
                  {ev.note ? <p className="mt-2 text-xs text-[var(--text-muted)]">{ev.note}</p> : null}
                </div>
              ))}
            </div>
          )}
        </section>
      </CardBody>
    </Card>
  );
}
