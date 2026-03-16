"use client";

import * as React from "react";
import { Button } from "@/ui/primitives/button";

type JobKey =
  | "notifications_process"
  | "slack_deliveries_process"
  | "sla_tick"
  | "inbox_daily"
  | "digests_weekly";

const JOBS: Array<{ key: JobKey; label: string }> = [
  { key: "notifications_process", label: "Run Notifications Processor" },
  { key: "slack_deliveries_process", label: "Run Slack Deliveries Processor" },
  { key: "sla_tick", label: "Run SLA Tick" },
  { key: "inbox_daily", label: "Run Daily Inbox Job" },
  { key: "digests_weekly", label: "Run Weekly Digest Job" },
];

export default function JobRunnerPanel({ orgId }: { orgId: string }) {
  const [busy, setBusy] = React.useState<JobKey | null>(null);
  const [message, setMessage] = React.useState<string | null>(null);

  async function run(job: JobKey) {
    setBusy(job);
    setMessage(null);
    const res = await fetch("/api/admin/jobs/trigger", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orgId, job }),
    });
    const json = (await res.json().catch(() => ({}))) as { error?: string };
    setBusy(null);
    if (!res.ok) {
      setMessage(json.error ?? "Job failed");
      return;
    }
    setMessage(`Job ${job} completed.`);
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-[var(--text-muted)]">
        Trigger background jobs manually for staging/pilot validation.
      </p>
      <div className="flex flex-wrap gap-2">
        {JOBS.map((j) => (
          <Button
            key={j.key}
            variant="outline"
            disabled={busy === j.key}
            onClick={() => void run(j.key)}
          >
            {busy === j.key ? "Running..." : j.label}
          </Button>
        ))}
      </div>
      {message ? <p className="text-xs text-[var(--text-muted)]">{message}</p> : null}
    </div>
  );
}
