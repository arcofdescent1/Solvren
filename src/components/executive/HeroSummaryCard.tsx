import type { ExecutiveChangeView } from "@/lib/executive/types";
import { Badge } from "@/ui/primitives/badge";

function recLabel(r: ExecutiveChangeView["recommendation"]): string {
  switch (r) {
    case "PROCEED":
      return "Proceed";
    case "PROCEED_WITH_CAUTION":
      return "Proceed With Caution";
    case "DELAY":
      return "Delay";
    case "ESCALATE":
      return "Escalate";
    default:
      return r;
  }
}

export function HeroSummaryCard({
  view,
  executiveLite = false,
}: {
  view: ExecutiveChangeView;
  executiveLite?: boolean;
}) {
  const scheduled = view.scheduledAt
    ? new Date(view.scheduledAt).toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : null;

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-6 shadow-sm md:p-8">
      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--text)] md:text-3xl">{view.title}</h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            {view.changeType} · Status: {view.status}
            {scheduled ? ` · Deployment scheduled: ${scheduled}` : ""}
          </p>
        </div>
        <Badge variant="secondary" className="w-fit shrink-0 text-xs uppercase">
          {executiveLite && !view.hasRiskAssessment
            ? "Risk score still calculating"
            : `Risk: ${view.riskLevel}`}
        </Badge>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-xl bg-[var(--bg-surface-2)] p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Recommendation</div>
          <div className="mt-1 text-lg font-semibold text-[var(--text)]">
            {executiveLite && !view.hasRiskAssessment
              ? "Recommendation pending additional evidence"
              : recLabel(view.recommendation)}
          </div>
        </div>
        <div className="rounded-xl bg-[var(--bg-surface-2)] p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Revenue at risk</div>
          <div className="mt-1 text-lg font-semibold text-[var(--text)]">
            {view.displayRevenueAtRisk ?? "—"}
          </div>
        </div>
        <div className="rounded-xl bg-[var(--bg-surface-2)] p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Confidence</div>
          <div className="mt-1 text-lg font-semibold text-[var(--text)]">
            {view.confidenceScore}% · {view.confidenceLabel}
          </div>
        </div>
      </div>
    </div>
  );
}
