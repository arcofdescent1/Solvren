"use client";

import { useEffect, useState } from "react";
import { Button, Card, CardBody, CardDescription, CardHeader, CardTitle } from "@/ui";
import { SuggestedApproversList } from "./SuggestedApproversList";
import { SuggestedEvidenceList } from "./SuggestedEvidenceList";
import { CoordinationBlockersList } from "./CoordinationBlockersList";
import { CoordinationSummary } from "./CoordinationSummary";

type PlanResponse = {
  plan: {
    summary: { coordinationSummary: string; whyTheseRecommendationsExist: string };
    approvals: {
      suggestedApprovers: Array<{ userId: string; displayName: string; role: string; source: string; required: boolean; reason: string }>;
      missingCoverage: Array<{ type: string; value: string; reason: string }>;
    };
    evidence: {
      requiredItems: Array<{ kind: string; title: string; reason: string; source: string }>;
      recommendedItems: Array<{ kind: string; title: string; reason: string; source: string }>;
    };
    notifications: {
      suggestedRecipients: Array<{ recipientType: string; recipientId: string; displayName: string; channel: string; reason: string }>;
    };
    blockers: Array<{ code: string; title: string; description: string; severity: "ERROR" | "WARNING" }>;
    actions: { canApplyApprovers: boolean; canApplyEvidence: boolean; canApplyNotifications: boolean };
  } | null;
  stale: boolean;
  generated_at?: string;
  version?: number;
  error?: string;
};

type CoordinationPlan = NonNullable<PlanResponse["plan"]>;

function normalizeCoordinationPlan(raw: PlanResponse["plan"]): CoordinationPlan | null {
  if (raw == null || typeof raw !== "object") return null;
  const p = raw as Partial<CoordinationPlan>;
  return {
    summary: {
      coordinationSummary: p.summary?.coordinationSummary ?? "",
      whyTheseRecommendationsExist: p.summary?.whyTheseRecommendationsExist ?? "",
    },
    approvals: {
      suggestedApprovers: Array.isArray(p.approvals?.suggestedApprovers) ? p.approvals.suggestedApprovers : [],
      missingCoverage: Array.isArray(p.approvals?.missingCoverage) ? p.approvals.missingCoverage : [],
    },
    evidence: {
      requiredItems: Array.isArray(p.evidence?.requiredItems) ? p.evidence.requiredItems : [],
      recommendedItems: Array.isArray(p.evidence?.recommendedItems) ? p.evidence.recommendedItems : [],
    },
    notifications: {
      suggestedRecipients: Array.isArray(p.notifications?.suggestedRecipients) ? p.notifications.suggestedRecipients : [],
    },
    blockers: Array.isArray(p.blockers) ? p.blockers : [],
    actions: {
      canApplyApprovers: Boolean(p.actions?.canApplyApprovers),
      canApplyEvidence: Boolean(p.actions?.canApplyEvidence),
      canApplyNotifications: Boolean(p.actions?.canApplyNotifications),
    },
  };
}

export function CoordinationAutopilotCard({ changeId, compact = false, autoGenerate = false }: { changeId: string; compact?: boolean; autoGenerate?: boolean }) {
  const [state, setState] = useState<PlanResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<null | "generate" | "approvers" | "evidence">(null);
  const [message, setMessage] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const res = await fetch(`/api/changes/${changeId}/coordination-plan`);
    const json = (await res.json()) as PlanResponse;
    setState(json);
    setLoading(false);
  }

  async function generate(regenerate: boolean) {
    setBusy("generate");
    setMessage(null);
    const res = await fetch(`/api/changes/${changeId}/coordination-plan/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ regenerate }),
    });
    const json = (await res.json()) as { error?: string };
    if (!res.ok) setMessage(json.error ?? "Review plan could not be built.");
    await load();
    setBusy(null);
  }

  async function applyApprovers() {
    setBusy("approvers");
    setMessage(null);
    const res = await fetch(`/api/changes/${changeId}/coordination-plan/apply-approvers`, { method: "POST" });
    const json = (await res.json()) as { inserted?: number; error?: string };
    if (!res.ok) setMessage(json.error ?? "Decision owners could not be added.");
    else setMessage(`Added ${json.inserted ?? 0} decision owner suggestion(s).`);
    await load();
    setBusy(null);
  }

  async function applyEvidence() {
    setBusy("evidence");
    setMessage(null);
    const res = await fetch(`/api/changes/${changeId}/coordination-plan/apply-evidence`, { method: "POST" });
    const json = (await res.json()) as { inserted?: number; error?: string };
    if (!res.ok) setMessage(json.error ?? "Proof checklist could not be added.");
    else setMessage(`Added ${json.inserted ?? 0} proof suggestion(s).`);
    window.dispatchEvent(new CustomEvent("evidence:refresh"));
    await load();
    setBusy(null);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [changeId]);

  useEffect(() => {
    if (!autoGenerate || loading) return;
    if (!state?.plan || state.stale) {
      generate(Boolean(state?.plan)).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoGenerate, loading, state?.stale, Boolean(state?.plan)]);

  const plan = normalizeCoordinationPlan(state?.plan ?? null);
  if (loading) return <div className="text-sm text-[var(--text-muted)]">Loading review plan...</div>;

  if (compact) {
    return (
      <div className="space-y-3">
        <CoordinationSummary plan={plan} stale={Boolean(state?.stale)} />
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => generate(Boolean(plan))} disabled={busy === "generate"}>{busy === "generate" ? "Building..." : plan ? "Refresh plan" : "Build review plan"}</Button>
          {plan?.actions.canApplyApprovers ? <Button variant="secondary" onClick={applyApprovers} disabled={busy === "approvers"}>{busy === "approvers" ? "Applying..." : "Add decision owners"}</Button> : null}
          {plan?.actions.canApplyEvidence ? <Button variant="secondary" onClick={applyEvidence} disabled={busy === "evidence"}>{busy === "evidence" ? "Applying..." : "Add proof checklist"}</Button> : null}
        </div>
        {message ? <div className="text-sm text-[var(--text-muted)]">{message}</div> : null}
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-4">
        <div>
          <CardTitle>Recommended path to approval</CardTitle>
          <CardDescription>Suggested decision owners, proof, and routing based on this change.</CardDescription>
        </div>
        <Button onClick={() => generate(Boolean(plan))} disabled={busy === "generate"}>{busy === "generate" ? "Building..." : plan ? "Refresh plan" : "Build review plan"}</Button>
      </CardHeader>
      <CardBody className="space-y-4">
        {state?.generated_at ? <p className="text-xs text-[var(--text-muted)]">Last updated {new Date(state.generated_at).toLocaleString()}</p> : null}
        {message ? <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-surface-2)] p-3 text-sm">{message}</div> : null}
        <CoordinationSummary plan={plan} stale={Boolean(state?.stale)} />
        {!plan ? (
          <div className="rounded-[var(--radius-md)] border border-dashed border-[var(--border)] bg-[var(--bg-surface-2)] p-4 text-sm text-[var(--text-muted)]">Build a review plan to suggest decision owners and proof requirements.</div>
        ) : (
          <>
            <section>
              <div className="mb-2 text-sm font-semibold">Recommended decision owners</div>
              <SuggestedApproversList items={plan.approvals.suggestedApprovers} />
              <div className="mt-2"><Button onClick={applyApprovers} disabled={busy === "approvers" || !plan.actions.canApplyApprovers}>{busy === "approvers" ? "Applying..." : "Add decision owners"}</Button></div>
            </section>
            <section className="grid gap-3 md:grid-cols-2">
              <SuggestedEvidenceList title="Required proof" items={plan.evidence.requiredItems} />
              <SuggestedEvidenceList title="Recommended proof" items={plan.evidence.recommendedItems} />
            </section>
            <Button onClick={applyEvidence} disabled={busy === "evidence" || !plan.actions.canApplyEvidence}>{busy === "evidence" ? "Applying..." : "Add proof checklist"}</Button>
            <section>
              <div className="mb-2 text-sm font-semibold">People to keep informed</div>
              {(plan.notifications.suggestedRecipients ?? []).length === 0 ? (
                <div className="text-sm text-[var(--text-muted)]">No notification suggestions.</div>
              ) : (
                <div className="space-y-2">
                  {plan.notifications.suggestedRecipients.map((n, i) => (
                    <div key={`${n.recipientType}:${n.recipientId}:${n.channel}:${i}`} className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-surface-2)] p-3 text-sm">
                      <div className="font-medium">{n.displayName}</div>
                      <div className="text-xs text-[var(--text-muted)]">{n.recipientType} | {n.channel}</div>
                      <div className="text-xs">{n.reason}</div>
                    </div>
                  ))}
                </div>
              )}
            </section>
            <section>
              <div className="mb-2 text-sm font-semibold">Blockers</div>
              <CoordinationBlockersList items={plan.blockers} />
            </section>
          </>
        )}
      </CardBody>
    </Card>
  );
}
