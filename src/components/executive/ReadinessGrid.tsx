import { AlertTriangle, CheckCircle2, Clock } from "lucide-react";
import type { ReadinessRow } from "@/lib/executive/types";

function StatusIcon({ status }: { status: ReadinessRow["status"] }) {
  if (status === "READY") return <CheckCircle2 className="h-5 w-5 text-emerald-500" aria-hidden />;
  if (status === "BLOCKED") return <AlertTriangle className="h-5 w-5 text-red-500" aria-hidden />;
  return <Clock className="h-5 w-5 text-amber-500" aria-hidden />;
}

export function ReadinessGrid({ rows }: { rows: ReadinessRow[] }) {
  const showBanner = rows.some(
    (r) =>
      r.status !== "READY" &&
      (r.category === "Support" || r.category === "Finance" || r.category === "Rollback Plan")
  );

  return (
    <section className="space-y-4">
      <h2 className="text-xl font-bold text-[var(--text)]">Readiness</h2>
      {showBanner ? (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-[var(--text)]">
          Support, Finance, or Rollback Plan still needs attention before this feels deployment-safe.
        </div>
      ) : null}
      <div className="overflow-hidden rounded-xl border border-[var(--border)]">
        <div className="grid grid-cols-[1fr_auto_1fr_1fr] gap-2 border-b border-[var(--border)] bg-[var(--bg-surface-2)] px-3 py-2 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)] md:grid-cols-[1.2fr_auto_1fr_1fr] md:px-4">
          <div>Category</div>
          <div className="text-center">Status</div>
          <div className="hidden sm:block">Owner</div>
          <div className="hidden md:block">Last updated</div>
        </div>
        {rows.map((r) => (
          <div
            key={r.category}
            className="grid grid-cols-[1fr_auto] items-center gap-2 border-t border-[var(--border)] px-3 py-3 text-sm md:grid-cols-[1.2fr_auto_1fr_1fr] md:px-4"
          >
            <div className="font-medium text-[var(--text)]">{r.category}</div>
            <div className="flex justify-center">
              <StatusIcon status={r.status} />
            </div>
            <div className="hidden text-[var(--text-muted)] sm:block">{r.owner ?? "Unassigned"}</div>
            <div className="hidden text-[var(--text-muted)] md:block">{r.updatedAt ? new Date(r.updatedAt).toLocaleString() : "—"}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
