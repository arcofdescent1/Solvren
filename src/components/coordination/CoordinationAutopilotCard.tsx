"use client";

import { useEffect, useState } from "react";
import { Button } from "@/ui";
import { SuggestedApproversList } from "./SuggestedApproversList";
import { SuggestedEvidenceList } from "./SuggestedEvidenceList";
import { CoordinationBlockersList } from "./CoordinationBlockersList";
import { CoordinationSummary } from "./CoordinationSummary";

type PlanResponse = {
  plan: {
    summary: {
      coordinationSummary: string;
      whyTheseRecommendationsExist: string;
    };
    approvals: {
      suggestedApprovers: Array<{
        userId: string;
        displayName: string;
        role: string;
        source: string;
        required: boolean;
        reason: string;
      }>;
      missingCoverage: Array<{ type: string; value: string; reason: string }>;
    };
    evidence: {
      requiredItems: Array<{ kind: string; title: string; reason: string; source: string }>;
      recommendedItems: Array<{ kind: string; title: string; reason: string; source: string }>;
    };
    notifications: {
      suggestedRecipients: Array<{
        recipientType: string;
        recipientId: string;
        displayName: string;
        channel: string;
        reason: string;
      }>;
    };
    blockers: Array<{
      code: string;
      title: string;
      description: string;
      severity: "ERROR" | "WARNING";
    }>;
    actions: {
      canApplyApprovers: boolean;
      canApplyEvidence: boolean;
      canApplyNotifications: boolean;
    };
  } | null;
  stale: boolean;
  generated_at?: string;
  version?: number;
  generated_by?: string;
  error?: string;
};

export function CoordinationAutopilotCard({
  changeId,
  compact = false,
  autoGenerate = false,
}: {
  changeId: string;
  compact?: boolean;
  autoGenerate?: boolean;
}) {
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
    if (!res.ok) setMessage(json.error ?? "Failed to generate coordination plan");
    await load();
    setBusy(null);
  }

  async function applyApprovers() {
    setBusy("approvers");
    setMessage(null);
    const res = await fetch(`/api/changes/${changeId}/coordination-plan/apply-approvers`, {
      method: "POST",
    });
    const json = (await res.json()) as { inserted?: number; error?: string };
    if (!res.ok) setMessage(json.error ?? "Failed to apply approvers");
    else setMessage(`Applied ${json.inserted ?? 0} approver suggestion(s).`);
    await load();
    setBusy(null);
  }

  async function applyEvidence() {
    setBusy("evidence");
    setMessage(null);
    const res = await fetch(`/api/changes/${changeId}/coordination-plan/apply-evidence`, {
      method: "POST",
    });
    const json = (await res.json()) as { inserted?: number; error?: string };
    if (!res.ok) setMessage(json.error ?? "Failed to apply evidence");
    else setMessage(`Added ${json.inserted ?? 0} evidence suggestion(s).`);
    window.dispatchEvent(new CustomEvent("evidence:refresh"));
    await load();
    setBusy(null);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [changeId]);

  useEffect(() => {
    if (!autoGenerate) return;
    if (loading) return;
    if (!state?.plan || state.stale) {
      generate(Boolean(state?.plan)).catch(() => {
        // Best effort auto-generation.
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoGenerate, loading, state?.stale, Boolean(state?.plan)]);

  const plan = state?.plan ?? null;
  if (loading) return <div className="text-sm text-[var(--text-muted)]">Generating Coordination Plan...</div>;

  if (compact) {
    return (
      <div className="space-y-2">
        <CoordinationSummary plan={plan} stale={Boolean(state?.stale)} />
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => generate(Boolean(plan))} disabled={busy === "generate"}>
            {busy === "generate" ? "Generating..." : plan ? "Regenerate" : "Generate Coordination Plan"}
          </Button>
          {plan?.actions.canApplyApprovers ? (
            <Button variant="secondary" onClick={applyApprovers} disabled={busy === "approvers"}>
              {busy === "approvers" ? "Applying..." : "Apply Suggested Approvers"}
            </Button>
          ) : null}
          {plan?.actions.canApplyEvidence ? (
            <Button variant="secondary" onClick={applyEvidence} disabled={busy === "evidence"}>
              {busy === "evidence" ? "Applying..." : "Generate Evidence Checklist"}
            </Button>
          ) : null}
        </div>
        {message ? <div className="text-xs text-[var(--text-muted)]">{message}</div> : null}
      </div>
    );
  }

  return (
    <div className="rounded-2xl border bg-white p-4 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="text-sm font-semibold">Coordination Autopilot</div>
          <div className="text-xs text-[var(--text-muted)]">
            Generated {state?.generated_at ? new Date(state.generated_at).toLocaleString() : "—"}
            {state?.version ? ` • v${state.version}` : ""}
            {state?.stale ? " • stale" : ""}
          </div>
        </div>
        <Button onClick={() => generate(Boolean(plan))} disabled={busy === "generate"}>
          {busy === "generate" ? "Generating..." : plan ? "Regenerate" : "Generate Coordination Plan"}
        </Button>
      </div>

      {message ? <div className="text-sm text-[var(--text-muted)]">{message}</div> : null}

      <CoordinationSummary plan={plan} stale={Boolean(state?.stale)} />

      {!plan ? (
        <div className="text-sm text-[var(--text-muted)]">No Coordination Plan generated yet.</div>
      ) : (
        <>
          <div>
            <div className="mb-2 text-sm font-semibold">Suggested Approvers</div>
            <SuggestedApproversList items={plan.approvals.suggestedApprovers} />
            <div className="mt-2">
              <Button onClick={applyApprovers} disabled={busy === "approvers" || !plan.actions.canApplyApprovers}>
                {busy === "approvers" ? "Applying..." : "Apply Suggested Approvers"}
              </Button>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <SuggestedEvidenceList title="Required Evidence" items={plan.evidence.requiredItems} />
            <SuggestedEvidenceList title="Recommended Evidence" items={plan.evidence.recommendedItems} />
          </div>
          <div>
            <Button onClick={applyEvidence} disabled={busy === "evidence" || !plan.actions.canApplyEvidence}>
              {busy === "evidence" ? "Applying..." : "Generate Evidence Checklist"}
            </Button>
          </div>

          <div>
            <div className="mb-2 text-sm font-semibold">Suggested Notification Routing</div>
            {plan.notifications.suggestedRecipients.length === 0 ? (
              <div className="text-sm text-[var(--text-muted)]">No notification routing suggestions.</div>
            ) : (
              <div className="space-y-2">
                {plan.notifications.suggestedRecipients.map((n, i) => (
                  <div key={`${n.recipientType}:${n.recipientId}:${n.channel}:${i}`} className="rounded border border-[var(--border)] p-2 text-sm">
                    <div className="font-medium">{n.displayName}</div>
                    <div className="text-xs text-[var(--text-muted)]">
                      {n.recipientType} • {n.channel}
                    </div>
                    <div className="text-xs">{n.reason}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <div className="mb-2 text-sm font-semibold">Blockers</div>
            <CoordinationBlockersList items={plan.blockers} />
          </div>
        </>
      )}
    </div>
  );
}
