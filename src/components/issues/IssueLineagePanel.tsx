/**
 * Phase 1 Gap 1 — Lineage: signal → detector → issue traceability.
 */
import { Card, CardBody } from "@/ui";

type LineageEntry = {
  sourceType: string;
  sourceRef: string;
  metadata?: Record<string, unknown>;
};

export function IssueLineagePanel({ lineage }: { lineage: LineageEntry[] }) {
  if (lineage.length === 0) {
    return (
      <Card>
        <CardBody>
          <h3 className="text-sm font-medium text-[var(--text-muted)] mb-2">Lineage</h3>
          <p className="text-sm text-[var(--text-muted)]">No lineage recorded.</p>
        </CardBody>
      </Card>
    );
  }

  const detector = lineage.find((l) => l.sourceType === "detector");
  const rules = lineage.filter((l) => l.sourceType === "rule");
  const signals = lineage.filter((l) => l.sourceType === "signal");

  return (
    <Card>
      <CardBody>
        <h3 className="text-sm font-medium text-[var(--text-muted)] mb-2">Lineage</h3>
        <p className="text-xs text-[var(--text-muted)] mb-2">Signal → Detector → Issue traceability</p>

        <div className="space-y-2 text-sm">
          {detector && (
            <div className="flex items-center gap-2">
              <span className="rounded bg-[var(--primary)]/10 px-1.5 py-0.5 text-xs">detector</span>
              <span className="font-mono text-xs">{detector.sourceRef}</span>
            </div>
          )}
          {rules.length > 0 && (
            <div className="flex flex-wrap gap-2">
              <span className="text-xs text-[var(--text-muted)]">Rules:</span>
              {rules.map((r, i) => (
                <span key={i} className="font-mono text-xs">
                  {r.sourceRef}
                </span>
              ))}
            </div>
          )}
          {signals.length > 0 && (
            <div>
              <p className="text-xs text-[var(--text-muted)] mb-1">Signals ({signals.length})</p>
              <ul className="font-mono text-xs text-[var(--text-muted)] space-y-0.5">
                {signals.slice(0, 5).map((s, i) => (
                  <li key={i}>{s.sourceRef.slice(0, 8)}…</li>
                ))}
                {signals.length > 5 && <li>…+{signals.length - 5} more</li>}
              </ul>
            </div>
          )}
        </div>
      </CardBody>
    </Card>
  );
}
