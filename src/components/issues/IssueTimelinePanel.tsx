import { Card, CardBody } from "@/ui";

type HistoryRow = {
  id: string;
  event_type: string;
  event_actor_ref: string | null;
  created_at: string;
  new_state_json?: Record<string, unknown> | null;
};

export function IssueTimelinePanel({ history }: { history: HistoryRow[] }) {
  return (
    <Card>
      <CardBody>
        <h3 className="text-sm font-medium text-[var(--text-muted)] mb-2">Timeline</h3>
        {history.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)]">No history yet.</p>
        ) : (
          <ul className="space-y-2">
            {history.map((h) => (
              <li key={h.id} className="flex flex-col gap-0.5 text-sm border-l-2 border-[var(--border)] pl-3">
                <span className="font-medium capitalize">{h.event_type.replace(/_/g, " ")}</span>
                <span className="text-xs text-[var(--text-muted)]">
                  {new Date(h.created_at).toLocaleString()}
                  {h.event_actor_ref && ` · ${h.event_actor_ref.slice(0, 8)}`}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}
