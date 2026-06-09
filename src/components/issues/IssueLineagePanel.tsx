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
          <h3 className="mb-2 text-sm font-medium text-[var(--text-muted)]">Source path</h3>
          <p className="text-sm text-[var(--text-muted)]">No source path recorded.</p>
        </CardBody>
      </Card>
    );
  }

  const detector = lineage.find((entry) => entry.sourceType === "detector");
  const rules = lineage.filter((entry) => entry.sourceType === "rule");
  const signals = lineage.filter((entry) => entry.sourceType === "signal");

  return (
    <Card>
      <CardBody>
        <h3 className="mb-2 text-sm font-medium text-[var(--text-muted)]">Source path</h3>
        <p className="mb-2 text-xs text-[var(--text-muted)]">How Solvren connected the signal to this problem.</p>

        <div className="space-y-2 text-sm">
          {detector ? (
            <div className="flex items-center gap-2">
              <span className="rounded-[var(--radius-sm)] bg-[var(--primary)]/10 px-1.5 py-0.5 text-xs text-[var(--primary)]">Detection rule</span>
              <span className="font-mono text-xs">{detector.sourceRef}</span>
            </div>
          ) : null}
          {rules.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              <span className="text-xs text-[var(--text-muted)]">Matched rules:</span>
              {rules.map((rule, index) => (
                <span key={`${rule.sourceRef}-${index}`} className="font-mono text-xs">
                  {rule.sourceRef}
                </span>
              ))}
            </div>
          ) : null}
          {signals.length > 0 ? (
            <div>
              <p className="mb-1 text-xs text-[var(--text-muted)]">Signals ({signals.length})</p>
              <ul className="space-y-0.5 font-mono text-xs text-[var(--text-muted)]">
                {signals.slice(0, 5).map((signal, index) => (
                  <li key={`${signal.sourceRef}-${index}`}>{signal.sourceRef.slice(0, 8)}...</li>
                ))}
                {signals.length > 5 ? <li>...+{signals.length - 5} more</li> : null}
              </ul>
            </div>
          ) : null}
        </div>
      </CardBody>
    </Card>
  );
}
