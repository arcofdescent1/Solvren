"use client";

import { useEffect, useState } from "react";
import { Card, CardBody } from "@/ui";

type ActionRow = {
  id: string;
  actionType: string;
  actionStatus: string;
  externalSystem: string;
  targetRef: string | null;
  createdAt: string;
  executedAt: string | null;
  error?: Record<string, unknown>;
};

type TaskRow = {
  id: string;
  externalSystem: string;
  externalTaskId: string | null;
  taskType: string;
  status: string;
  dueAt: string | null;
  createdAt: string;
};

type AvailableAction = {
  actionKey: string;
  provider: string;
  displayName: string;
  paramsSchema: Array<{ key: string; label: string; type: string; required?: boolean }>;
  riskLevel?: string;
  executionMode?: string;
  autoEligible?: boolean;
  suggested?: boolean;
};

type RecommendedData = {
  recommended?: AvailableAction[];
  playbooks?: Array<{ playbookKey: string; displayName: string; description: string }>;
  impact?: { revenueAtRisk: number; confidenceScore: number };
};

export function IssueActionsPanel({
  issueId,
  issueTitle,
  orgId,
  connectedProviders,
  revenueAtRisk,
}: {
  issueId: string;
  issueTitle: string;
  orgId?: string;
  connectedProviders?: string[];
  revenueAtRisk?: number | null;
}) {
  const [actions, setActions] = useState<ActionRow[]>([]);
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [availableActions, setAvailableActions] = useState<AvailableAction[]>([]);
  const [recommended, setRecommended] = useState<RecommendedData | null>(null);
  const [loading, setLoading] = useState(true);
  const [executing, setExecuting] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/issues/${issueId}/actions`)
      .then((r) => r.json())
      .then((d) => {
        setActions(d.actions ?? []);
        setTasks(d.tasks ?? []);
      })
      .finally(() => setLoading(false));
  }, [issueId]);

  useEffect(() => {
    const url = orgId ? `/api/execution/available-actions?orgId=${encodeURIComponent(orgId)}` : "/api/execution/available-actions";
    fetch(url)
      .then((r) => r.json())
      .then((d) => setAvailableActions(d.actions ?? []))
      .catch(() => {});
  }, [orgId]);

  useEffect(() => {
    fetch(`/api/execution/recommended-actions?issueId=${encodeURIComponent(issueId)}`)
      .then((r) => r.json())
      .then((d) => setRecommended(d))
      .catch(() => {});
  }, [issueId]);

  const filteredActions = (connectedProviders?.length
    ? availableActions.filter((a) => connectedProviders.includes(a.provider))
    : availableActions);

  const fetchActions = () =>
    fetch(`/api/issues/${issueId}/actions`)
      .then((r) => r.json())
      .then((d) => {
        setActions(d.actions ?? []);
        setTasks(d.tasks ?? []);
      });

  const handleExecute = async (actionKey: string, provider: string, params: Record<string, unknown>) => {
    setExecuting(`${provider}:${actionKey}`);
    try {
      const res = await fetch(`/api/issues/${issueId}/actions/execute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actionKey, provider, params }),
      });
      if (res.ok) await fetchActions();
    } finally {
      setExecuting(null);
    }
  };

  const displayImpact = revenueAtRisk ?? recommended?.impact?.revenueAtRisk ?? 0;
  const hasImpact = displayImpact > 0;

  if (loading) {
    return (
      <Card>
        <CardBody>
          <h3 className="text-sm font-medium text-[var(--text-muted)] mb-2">Actions</h3>
          <p className="text-sm text-[var(--text-muted)]">Loading…</p>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card>
      <CardBody>
        <h3 className="text-sm font-medium text-[var(--text-muted)] mb-2">Actions & tasks</h3>

        {hasImpact && (
          <p className="text-xs text-[var(--text-muted)] mb-3">
            Impact: ${Number(displayImpact).toLocaleString()} at risk
          </p>
        )}

        {recommended?.recommended && recommended.recommended.length > 0 && (
          <div className="mb-4">
            <p className="text-xs font-medium text-[var(--text-muted)] mb-2">Recommended actions</p>
            <ul className="space-y-1.5">
              {recommended.recommended.slice(0, 5).map((a) => (
                <li key={a.actionKey} className="flex items-center gap-2 text-sm">
                  <span className={a.autoEligible ? "text-[var(--success)]" : a.suggested ? "text-[var(--primary)]" : "text-[var(--text)]"}>
                    {a.autoEligible ? "✔" : "○"} {a.displayName}
                  </span>
                  <RiskBadge level={a.riskLevel} />
                  {a.autoEligible && <span className="text-xs text-[var(--success)]">Auto eligible</span>}
                  <QuickActionButton
                    action={a}
                    issueTitle={issueTitle}
                    executing={executing === `${a.provider}:${a.actionKey}`}
                    onExecute={(params) => handleExecute(a.actionKey, a.provider, params)}
                    compact
                  />
                </li>
              ))}
            </ul>
          </div>
        )}

        {actions.length > 0 && (
          <ul className="space-y-2 mb-4">
            {actions.map((a) => (
              <li key={a.id} className="text-sm flex items-center gap-2 flex-wrap">
                <span className="font-mono text-xs">{a.externalSystem}/{a.actionType.split(".").pop() ?? a.actionType}</span>
                <span className={a.actionStatus === "done" ? "text-[var(--success)]" : a.actionStatus === "failed" ? "text-[var(--danger)]" : "text-[var(--text-muted)]"}>
                  {a.actionStatus}
                </span>
                {a.targetRef && <span className="text-xs truncate max-w-[120px]">{a.targetRef}</span>}
                <span className="text-xs text-[var(--text-muted)]">
                  {new Date(a.executedAt ?? a.createdAt).toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        )}

        {filteredActions.length > 0 && !recommended?.recommended?.length && (
          <div className="space-y-2">
            <p className="text-xs text-[var(--text-muted)] mb-1">Execute action</p>
            {filteredActions.map((a) => (
              <QuickActionButton
                key={`${a.provider}:${a.actionKey}`}
                action={a}
                issueTitle={issueTitle}
                executing={executing === `${a.provider}:${a.actionKey}`}
                onExecute={(params) => handleExecute(a.actionKey, a.provider, params)}
              />
            ))}
          </div>
        )}

        {recommended?.recommended?.length === 0 && filteredActions.length > 0 && (
          <div className="space-y-2 mt-2">
            <p className="text-xs text-[var(--text-muted)] mb-1">Other actions</p>
            {filteredActions.map((a) => (
              <QuickActionButton
                key={`${a.provider}:${a.actionKey}`}
                action={a}
                issueTitle={issueTitle}
                executing={executing === `${a.provider}:${a.actionKey}`}
                onExecute={(params) => handleExecute(a.actionKey, a.provider, params)}
              />
            ))}
          </div>
        )}

        {recommended?.playbooks && recommended.playbooks.length > 0 && (
          <div className="mt-4 pt-3 border-t border-[var(--border)]">
            <p className="text-xs font-medium text-[var(--text-muted)] mb-1">Playbooks</p>
            <ul className="text-xs text-[var(--text-muted)] space-y-0.5">
              {recommended.playbooks.map((p) => (
                <li key={p.playbookKey}>{p.displayName}: {p.description}</li>
              ))}
            </ul>
          </div>
        )}

        {actions.length === 0 && filteredActions.length === 0 && (
          <p className="text-sm text-[var(--text-muted)]">No actions yet. Connect Jira, Slack, Stripe, or HubSpot to create tasks.</p>
        )}
      </CardBody>
    </Card>
  );
}

function RiskBadge({ level }: { level?: string }) {
  if (!level) return null;
  const c = level === "low" ? "var(--success)" : level === "medium" ? "var(--warning)" : "var(--danger)";
  return <span className="text-[10px] px-1 rounded" style={{ backgroundColor: `${c}20`, color: c }}>{level}</span>;
}

function QuickActionButton({
  action,
  issueTitle,
  executing,
  onExecute,
  compact,
}: {
  action: AvailableAction;
  issueTitle: string;
  executing: boolean;
  onExecute: (params: Record<string, unknown>) => void;
  compact?: boolean;
}) {
  const [showForm, setShowForm] = useState(false);
  const [params, setParams] = useState<Record<string, string>>({});

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const out: Record<string, unknown> = {};
    for (const p of action.paramsSchema) {
      const v = params[p.key];
      if (p.required && !v) return;
      if (v != null) out[p.key] = p.type === "number" ? parseFloat(v) : v;
    }
    if ((action.actionKey === "jira.create_issue" || action.actionKey.includes("create_issue")) && !out.summary) out.summary = issueTitle;
    if (action.actionKey.includes("post_issue_summary") && !out.channelId) return;
    onExecute(out);
    setShowForm(false);
    setParams({});
  };

  if (!showForm) {
    return (
      <button
        type="button"
        onClick={() => setShowForm(true)}
        disabled={executing}
        className={`text-[var(--primary)] hover:underline disabled:opacity-50 ${compact ? "text-xs ml-auto" : "text-sm"}`}
      >
        {executing ? "Executing…" : "Execute"}
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="rounded border border-[var(--border)] p-2 space-y-2 mt-1">
      <p className="text-xs font-medium">{action.displayName}</p>
      {action.paramsSchema.map((p) => (
        <div key={p.key}>
          <label className="text-xs text-[var(--text-muted)]">{p.label}</label>
          <input
            type={p.type === "number" ? "number" : "text"}
            value={params[p.key] ?? (p.key === "summary" ? issueTitle : "")}
            onChange={(e) => setParams((prev) => ({ ...prev, [p.key]: e.target.value }))}
            placeholder={p.key === "projectKey" ? "e.g. PROJ" : undefined}
            className="w-full rounded border border-[var(--border)] px-2 py-1 text-sm mt-0.5"
          />
        </div>
      ))}
      <div className="flex gap-2">
        <button type="submit" className="text-xs font-medium text-[var(--primary)] hover:underline">
          Execute
        </button>
        <button type="button" onClick={() => setShowForm(false)} className="text-xs text-[var(--text-muted)] hover:underline">
          Cancel
        </button>
      </div>
    </form>
  );
}
