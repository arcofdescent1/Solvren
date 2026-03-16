"use client";;
import { Button, Input, NativeSelect, Textarea } from "@/ui";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
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
  /** @deprecated use what_good_looks_like */
  checklist_items?: string[];
  /** @deprecated use example_links */
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
  /** When present (e.g. from server template), overrides requiredEvidenceKinds. */
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

  const evidenceKindsPresent = useMemo(() => {
    return new Set((evidence ?? []).map((e) => e.kind));
  }, [evidence]);

  const requiredKinds = useMemo(() => {
    return (requiredEvidenceKindsOverride ?? requiredEvidenceKinds) ?? [];
  }, [requiredEvidenceKindsOverride, requiredEvidenceKinds]);

  const missingRequired = useMemo(() => {
    return requiredKinds.filter((k) => !evidenceKindsPresent.has(k));
  }, [requiredKinds, evidenceKindsPresent]);

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
      setMsg(json?.error ?? "Failed to add evidence.");
      return;
    }

    setKind("PR");
    setLabel("");
    setUrl("");
    setNote("");
    setMsg("Evidence added.");
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
      setMsg((json as { error?: string })?.error ?? "Failed to suggest evidence.");
      return;
    }

    setMsg("Suggestions generated.");
    router.refresh();
  }

  const suggestions =
    (missingEvidenceSuggestions?.suggestions ?? []) as Suggestion[];
  const missingFromAI = missingEvidenceSuggestions?.missing_kinds ?? [];

  return (
    <div id="evidence-panel" className="border rounded p-4 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-semibold">Evidence</h2>
          <p className="text-sm opacity-70">
            Attach links and notes that prove the change is safe to ship.
          </p>
        </div>

        {riskBucket && (
          <div className="text-xs border rounded px-2 py-1 opacity-80">
            Required for {riskBucket}: {requiredKinds.length}
          </div>
        )}
      </div>
      {riskBucket && (
        <div className="border rounded p-3 space-y-2">
          <div className="text-sm font-semibold">Required evidence</div>
          {requiredKinds.length === 0 ? (
            <div className="text-sm opacity-70">
              None required for this risk level.
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {requiredKinds.map((k) => {
                const ok = evidenceKindsPresent.has(k);
                return (
                  <span
                    key={k}
                    className={`text-xs px-2 py-1 rounded border ${
                      ok ? "bg-black text-white" : "opacity-70"
                    }`}
                  >
                    {EVIDENCE_KIND_LABEL[k]}
                    {ok ? " ✓" : ""}
                  </span>
                );
              })}
            </div>
          )}

          {missingRequired.length > 0 && (
            <div className="space-y-2">
              <div className="text-sm opacity-80">
                Missing:{" "}
                <span className="font-semibold">
                  {missingRequired.map((k) => EVIDENCE_KIND_LABEL[k as EvidenceKind]).join(", ")}
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  onClick={suggestEvidence}
                  disabled={suggestLoading}
                  className="px-3 py-1.5 rounded border text-sm disabled:opacity-60"
                >
                  {suggestLoading
                    ? "Suggesting..."
                    : suggestions.length > 0
                      ? "Refresh suggestions"
                      : "Suggest evidence to attach"}
                </Button>
              </div>
              {suggestions.length > 0 && (
                <div className="mt-3 space-y-3 border-t pt-3">
                  <div className="text-sm font-semibold">
                    Suggested evidence to attach
                  </div>
                  {suggestions.map((s, idx) => {
                    const items =
                      s.what_good_looks_like ?? s.checklist_items ?? [];
                    const links =
                      s.example_links ?? s.suggested_url_types ?? [];
                    return (
                      <div
                        key={idx}
                        className="border rounded p-3 text-sm space-y-2"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="font-medium">
                            {EVIDENCE_KIND_LABEL[s.kind as EvidenceKind]}:{" "}
                            {s.suggested_label}
                          </div>
                          <Button
                            type="button"
                            onClick={() => {
                              setKind(s.kind as EvidenceKind);
                              setLabel(s.suggested_label);
                              setUrl("");
                              setNote("");

                              const links =
                                s.example_links ?? s.suggested_url_types ?? [];
                              const firstUrl = links.find((x) =>
                                /^https?:\/\//i.test(x)
                              );
                              if (firstUrl) setUrl(firstUrl);

                              const items =
                                s.what_good_looks_like ??
                                s.checklist_items ??
                                [];
                              if (items.length > 0)
                                setNote(items.map((x) => `- ${x}`).join("\n"));
                            }}
                            className="text-xs px-2 py-1 rounded border shrink-0"
                          >
                            Use template
                          </Button>
                        </div>
                        {items.length > 0 && (
                          <ul className="list-disc pl-5 text-xs opacity-80">
                            {items.map((item, i) => (
                              <li key={i}>{item}</li>
                            ))}
                          </ul>
                        )}
                        {links.length > 0 && (
                          <div className="text-xs opacity-70">
                            Example links: {links.join(", ")}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}
      <form onSubmit={addEvidence} className="border rounded p-3 space-y-3">
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <div className="text-sm font-medium">Kind</div>
            <NativeSelect
              className="border rounded px-3 py-2 w-full"
              value={kind}
              onChange={(e) => setKind(e.target.value as EvidenceKind)}
            >
              {Object.keys(EVIDENCE_KIND_LABEL).map((k) => (
                <option key={k} value={k}>
                  {EVIDENCE_KIND_LABEL[k as EvidenceKind]}
                </option>
              ))}
            </NativeSelect>
          </div>

          <div className="space-y-1">
            <div className="text-sm font-medium">Label</div>
            <Input
              className="border rounded px-3 py-2 w-full"
              placeholder="e.g. Stripe annual plan PR"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-1">
          <div className="text-sm font-medium">URL (optional)</div>
          <Input
            className="border rounded px-3 py-2 w-full"
            placeholder="https://github.com/org/repo/pull/123"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
        </div>

        <div className="space-y-1">
          <div className="text-sm font-medium">Note (optional)</div>
          <Textarea
            className="border rounded px-3 py-2 w-full min-h-20"
            placeholder="What does this prove? Any instructions?"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>

        <div className="flex items-center justify-between gap-3">
          <Button
            className="px-3 py-2 rounded bg-black text-white text-sm disabled:opacity-60"
            disabled={loading || !orgId}
          >
            {loading ? "Adding..." : "Add evidence"}
          </Button>
          {msg && <span className="text-xs opacity-70">{msg}</span>}
        </div>
      </form>
      <div className="space-y-2">
        <div className="text-sm font-semibold">Evidence items</div>
        {!evidence || evidence.length === 0 ? (
          <div className="text-sm opacity-70">No evidence attached yet.</div>
        ) : (
          <div className="space-y-2">
            {evidence.map((ev) => (
              <div key={ev.id} className="border rounded p-3 text-sm space-y-1">
                <div className="flex items-center justify-between gap-3">
                  <div className="font-semibold">
                    {ev.kind}: {ev.label}
                  </div>
                  <div className="text-xs opacity-60">
                    {new Date(ev.created_at).toLocaleString()}
                  </div>
                </div>
                {ev.url && (
                  <div className="text-xs">
                    <a
                      className="underline"
                      href={ev.url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {ev.url}
                    </a>
                  </div>
                )}
                {ev.note && (
                  <div className="text-xs opacity-80">{ev.note}</div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
