/**
 * Phase 1 Gap 1 — Evidence panel: rule matches, raw signals, explainability.
 */
import { Card, CardBody } from "@/ui";

type EvidenceItem = {
  evidenceType: string;
  evidenceKey: string;
  payload: Record<string, unknown>;
  confidence?: number | null;
};

export function IssueEvidencePanel({
  evidence,
  evidenceJson,
  detectorKey,
}: {
  evidence: EvidenceItem[];
  evidenceJson?: Record<string, unknown> | null;
  detectorKey?: string | null;
}) {
  const ruleMatches = evidence.filter((e) => e.evidenceType === "rule_match");
  const rawSignals = evidence.filter((e) => e.evidenceType === "raw_signal");
  const other = evidence.filter((e) => !["rule_match", "raw_signal"].includes(e.evidenceType));

  const hasContent = ruleMatches.length > 0 || rawSignals.length > 0 || other.length > 0 || (evidenceJson && Object.keys(evidenceJson).length > 0);

  if (!hasContent) {
    return (
      <Card>
        <CardBody>
          <h3 className="text-sm font-medium text-[var(--text-muted)] mb-2">Evidence</h3>
          <p className="text-sm text-[var(--text-muted)]">No structured evidence attached.</p>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card>
      <CardBody>
        <h3 className="text-sm font-medium text-[var(--text-muted)] mb-2">Evidence</h3>
        {detectorKey && (
          <p className="text-xs text-[var(--text-muted)] mb-2">
            Detector: <span className="font-mono">{detectorKey}</span>
          </p>
        )}

        {ruleMatches.length > 0 && (
          <div className="mb-3">
            <p className="text-xs text-[var(--text-muted)] mb-1">Rule matches</p>
            <ul className="space-y-1.5">
              {ruleMatches.map((r, i) => (
                <li key={`${r.evidenceKey}-${i}`} className="text-sm rounded bg-[var(--bg-surface-2)] p-2">
                  <span className="font-medium">{formatEvidenceKey(r.evidenceKey)}</span>
                  {r.payload.headline != null && (
                    <p className="mt-0.5 text-[var(--text-muted)]">{String(r.payload.headline)}</p>
                  )}
                  {r.payload.threshold != null && (
                    <p className="text-xs mt-0.5">
                      {String(r.payload.threshold)}: {String(r.payload.actual)} (limit: {String(r.payload.limit ?? "—")})
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {rawSignals.length > 0 && (
          <div className="mb-3">
            <p className="text-xs text-[var(--text-muted)] mb-1">Signals</p>
            <ul className="space-y-1 text-sm">
              {rawSignals.map((s, i) => (
                <li key={`${s.evidenceKey}-${i}`} className="font-mono text-xs">
                  {s.payload.signalKey as string} @ {(s.payload.signalTime as string)?.slice?.(0, 19)}
                </li>
              ))}
            </ul>
          </div>
        )}

        {evidenceJson && Object.keys(evidenceJson).length > 0 && (
          <div className="mt-2 pt-2 border-t border-[var(--border)]">
            <p className="text-xs text-[var(--text-muted)] mb-1">Raw evidence</p>
            <pre className="text-xs overflow-auto max-h-40 rounded bg-[var(--bg-surface-2)] p-2">
              {JSON.stringify(evidenceJson, null, 2)}
            </pre>
          </div>
        )}
      </CardBody>
    </Card>
  );
}

function formatEvidenceKey(key: string): string {
  return key
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
