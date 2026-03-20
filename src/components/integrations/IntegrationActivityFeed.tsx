"use client";

/**
 * Phase 1 — Activity feed (§13.4): sync jobs, action logs, webhook events.
 */
import * as React from "react";

export type SyncJobItem = {
  id: string;
  job_type: string;
  status: string;
  trigger_source: string;
  created_at: string;
  completed_at: string | null;
};

export type ActionLogItem = {
  id: string;
  action_type: string;
  status: string;
  created_at: string;
};

export type WebhookEventItem = {
  id: string;
  event_type: string;
  processed_status: string;
  received_at: string;
};

export type IntegrationActivityFeedProps = {
  syncJobs: SyncJobItem[];
  actionLogs: ActionLogItem[];
  webhookEvents: WebhookEventItem[];
};

export function IntegrationActivityFeed({ syncJobs, actionLogs, webhookEvents }: IntegrationActivityFeedProps) {
  const hasAny = syncJobs.length > 0 || actionLogs.length > 0 || webhookEvents.length > 0;
  if (!hasAny) {
    return <p className="text-sm text-[var(--text-muted)]">No recent activity.</p>;
  }

  const formatDate = (s: string) => new Date(s).toLocaleString();

  return (
    <div className="space-y-4">
      {syncJobs.length > 0 && (
        <div>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Sync jobs</h4>
          <ul className="space-y-1 rounded-md border border-[var(--border)] p-2">
            {syncJobs.slice(0, 10).map((j) => (
              <li key={j.id} className="flex items-center justify-between text-sm">
                <span className="text-[var(--text)]">{j.job_type} — {j.trigger_source}</span>
                <span className={`font-medium ${j.status === "completed" ? "text-emerald-600" : j.status === "failed" ? "text-red-600" : "text-[var(--text-muted)]"}`}>
                  {j.status}
                </span>
                <span className="text-xs text-[var(--text-muted)]">{formatDate(j.created_at)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {actionLogs.length > 0 && (
        <div>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Actions</h4>
          <ul className="space-y-1 rounded-md border border-[var(--border)] p-2">
            {actionLogs.slice(0, 10).map((a) => (
              <li key={a.id} className="flex items-center justify-between text-sm">
                <span className="text-[var(--text)]">{a.action_type}</span>
                <span className={a.status === "success" ? "text-emerald-600" : "text-red-600"}>{a.status}</span>
                <span className="text-xs text-[var(--text-muted)]">{formatDate(a.created_at)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {webhookEvents.length > 0 && (
        <div>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Webhook events</h4>
          <ul className="space-y-1 rounded-md border border-[var(--border)] p-2">
            {webhookEvents.slice(0, 10).map((e) => (
              <li key={e.id} className="flex items-center justify-between text-sm">
                <span className="text-[var(--text)]">{e.event_type}</span>
                <span className="text-[var(--text-muted)]">{e.processed_status}</span>
                <span className="text-xs text-[var(--text-muted)]">{formatDate(e.received_at)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
