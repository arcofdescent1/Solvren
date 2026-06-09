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
  const hasRawEvidence = Boolean(evidenceJson && Object.keys(evidenceJson).length > 0);
  const hasContent = ruleMatches.length > 0 || rawSignals.length > 0 || other.length > 0 || hasRawEvidence;

  if (!hasContent) {
    return (
      <Card>
        <CardBody>
          <h3 className="mb-2 text-sm font-medium text-[var(--text-muted)]">Proof</h3>
          <p className="text-sm text-[var(--text-muted)]">No structured proof attached yet.</p>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card>
      <CardBody>
        <h3 className="mb-2 text-sm font-medium text-[var(--text-muted)]">Proof</h3>
        {detectorKey ? (
          <p className="mb-2 text-xs text-[var(--text-muted)]">
            Detection rule: <span className="font-mono">{detectorKey}</span>
          </p>
        ) : null}

        {ruleMatches.length > 0 ? (
          <div className="mb-3">
            <p className="mb-1 text-xs text-[var(--text-muted)]">Rule matches</p>
            <ul className="space-y-1.5">
              {ruleMatches.map((rule, index) => (
                <li key={`${rule.evidenceKey}-${index}`} className="rounded-[var(--radius-md)] bg-[var(--bg-surface-2)] p-2 text-sm">
                  <span className="font-medium">{formatEvidenceKey(rule.evidenceKey)}</span>
                  {rule.payload.headline != null ? (
                    <p className="mt-0.5 text-[var(--text-muted)]">{String(rule.payload.headline)}</p>
                  ) : null}
                  {rule.payload.threshold != null ? (
                    <p className="mt-0.5 text-xs">
                      {String(rule.payload.threshold)}: {String(rule.payload.actual)} (limit: {String(rule.payload.limit ?? "-")})
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {rawSignals.length > 0 ? (
          <div className="mb-3">
            <p className="mb-1 text-xs text-[var(--text-muted)]">Signals</p>
            <ul className="space-y-1 text-sm">
              {rawSignals.map((signal, index) => (
                <li key={`${signal.evidenceKey}-${index}`} className="font-mono text-xs">
                  {signal.payload.signalKey as string} @ {(signal.payload.signalTime as string)?.slice?.(0, 19)}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {hasRawEvidence ? (
          <div className="mt-2 border-t border-[var(--border)] pt-2">
            <p className="mb-1 text-xs text-[var(--text-muted)]">Raw proof</p>
            <pre className="max-h-40 overflow-auto rounded-[var(--radius-md)] bg-[var(--bg-surface-2)] p-2 text-xs">
              {JSON.stringify(evidenceJson, null, 2)}
            </pre>
          </div>
        ) : null}
      </CardBody>
    </Card>
  );
}

function formatEvidenceKey(key: string): string {
  return key.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}
