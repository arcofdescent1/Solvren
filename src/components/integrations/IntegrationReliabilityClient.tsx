"use client";

import Link from "next/link";
import { Card, CardBody } from "@/ui";

type HealthItem = {
  id: string;
  provider: string;
  displayName: string;
  status: string;
  healthState: string;
  metrics: Record<string, number>;
  lastSuccessAt: string | null;
  lastErrorAt: string | null;
};

type DeadLetter = {
  id: string;
  provider: string;
  dead_letter_type: string;
  reason_code: string;
  reason_message: string;
  retryable: boolean;
  status: string;
  created_at: string;
};

type Execution = {
  id: string;
  provider: string;
  action_key: string;
  execution_status: string;
  attempt_count: number;
  created_at: string;
};

export function IntegrationReliabilityClient({
  healthData,
  deadLetters,
  recentExecutions,
}: {
  healthData: HealthItem[];
  deadLetters: DeadLetter[];
  recentExecutions: Execution[];
}) {
  const healthBadgeColor = (s: string) => {
    if (s === "HEALTHY") return "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300";
    if (s === "DEGRADED") return "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300";
    return "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300";
  };

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card>
        <CardBody>
          <h3 className="text-sm font-medium text-[var(--text-muted)] mb-3">Connector health</h3>
          {healthData.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)]">No integrations configured.</p>
          ) : (
            <ul className="space-y-2">
              {healthData.map((h) => (
                <li key={h.id} className="flex items-center justify-between text-sm">
                  <span>{h.displayName || h.provider}</span>
                  <span className={`rounded px-1.5 py-0.5 text-xs ${healthBadgeColor(h.healthState)}`}>
                    {h.healthState}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardBody>
          <h3 className="text-sm font-medium text-[var(--text-muted)] mb-3">Dead-letter queue</h3>
          {deadLetters.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)]">No open dead letters.</p>
          ) : (
            <ul className="space-y-2">
              {deadLetters.slice(0, 10).map((d) => (
                <li key={d.id} className="flex items-center justify-between text-sm">
                  <span>
                    {d.provider} · {d.reason_code}
                  </span>
                  <Link href="/admin/integrations/dead-letters" className="text-xs text-[var(--primary)] hover:underline">
                    View
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <Link href="/admin/integrations/dead-letters" className="mt-3 inline-block text-sm font-medium text-[var(--primary)] hover:underline">
            Dead-letter queue →
          </Link>
        </CardBody>
      </Card>

      <Card className="md:col-span-2">
        <CardBody>
          <h3 className="text-sm font-medium text-[var(--text-muted)] mb-3">Recent executions</h3>
          {recentExecutions.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)]">No executions yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)]">
                    <th className="text-left py-2">Provider</th>
                    <th className="text-left py-2">Action</th>
                    <th className="text-left py-2">Status</th>
                    <th className="text-left py-2">Attempts</th>
                    <th className="text-left py-2">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {recentExecutions.map((e) => (
                    <tr key={e.id} className="border-b border-[var(--border)]">
                      <td className="py-1.5">{e.provider}</td>
                      <td className="py-1.5 font-mono text-xs">{e.action_key}</td>
                      <td className="py-1.5">{e.execution_status}</td>
                      <td className="py-1.5">{e.attempt_count}</td>
                      <td className="py-1.5 text-[var(--text-muted)]">
                        {new Date(e.created_at).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <Link href="/admin/integrations/executions" className="mt-3 inline-block text-sm font-medium text-[var(--primary)] hover:underline">
            View all executions →
          </Link>
        </CardBody>
      </Card>
    </div>
  );
}
