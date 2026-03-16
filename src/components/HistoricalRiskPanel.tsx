const pct1 = (x?: number) => (x == null ? "—" : `${(x * 100).toFixed(1)}%`);
const pct0 = (x?: number) => (x == null ? "—" : `${Math.round((x ?? 0) * 100)}%`);
const signedPct0 = (x?: number) =>
  x == null ? "—" : `${x >= 0 ? "+" : ""}${Math.round(x * 100)}%`;

export default function HistoricalRiskPanel(props: {
  baselineRate: number;
  windowDays: number;
  minSamples: number;
  rows: Array<{
    signal_key: string;
    contribution: number | null;
    weight_at_time: number | null;
    incident_rate: number;
    total_changes: number;
    sample_ok?: boolean;
    bayes_mean?: number;
    bayes_ci_low?: number;
    bayes_ci_high?: number;
    bayes_confidence?: number;
    mitigation_lift?: number;
    mitigation_ci_low?: number;
    mitigation_ci_high?: number;
  }>;
}) {
  const { baselineRate, windowDays, minSamples, rows } = props;
  const fmtPct = (n: number) => `${Math.round(n * 100)}%`;

  return (
    <div className="border rounded p-4 space-y-3">
      <div className="flex items-baseline justify-between">
        <h2 className="font-semibold">Historical risk memory</h2>
        <div className="text-xs opacity-70">
          Baseline incident rate: {fmtPct(baselineRate)}
        </div>
      </div>

      <div className="text-xs opacity-60 mb-2">
        Incidents within {windowDays} days of submission. Learning applies when n ≥ {minSamples}.
      </div>

      <div className="space-y-2">
        {rows.map((r) => {
          const delta = r.incident_rate - baselineRate;
          const sampleOk =
            typeof r.sample_ok === "boolean" ? r.sample_ok : r.total_changes >= minSamples;

          const multiplier = sampleOk ? Math.max(0.5, Math.min(2.0, 1 + delta)) : null;

          return (
            <div key={r.signal_key} className="text-sm border rounded p-2">
              <div className="flex justify-between gap-3">
                <span className="font-mono">
                  {r.signal_key}
                  {sampleOk === false && (
                    <span className="ml-2 text-xs opacity-60">(warming up)</span>
                  )}
                </span>
                <span className="opacity-70 text-xs">
                  +{r.contribution ?? 0} (w={r.weight_at_time ?? 0})
                </span>
              </div>

              <div className="opacity-80 mt-1 space-y-1">
                <div>
                  Incident rate: <b>{fmtPct(r.incident_rate)}</b>{" "}
                  <span className="opacity-70">(n={r.total_changes})</span>
                  {" • "}
                  Baseline: {fmtPct(baselineRate)}
                  {" • "}
                  Δ {delta >= 0 ? "+" : ""}
                  {fmtPct(delta)}
                  {multiplier != null && (
                    <>
                      {" • "}
                      Multiplier: {multiplier.toFixed(2)}x
                    </>
                  )}
                </div>
                {(r.bayes_mean != null || r.mitigation_lift != null) && (
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
                    {r.bayes_mean != null && (
                      <span>
                        Predicted:{" "}
                        <span className="font-semibold">
                          {pct1(r.bayes_mean)}{" "}
                          <span className="opacity-70">
                            (90% CI {pct1(r.bayes_ci_low)}–{pct1(r.bayes_ci_high)})
                          </span>
                        </span>
                        {r.bayes_confidence != null && (
                          <span className="ml-1 opacity-70">• Confidence {pct0(r.bayes_confidence)}</span>
                        )}
                      </span>
                    )}
                    {r.mitigation_lift != null && (
                      <span
                        className={
                          Number(r.mitigation_lift ?? 0) < 0 ? "text-emerald-700 font-semibold" : "text-amber-700 font-semibold"
                        }
                      >
                        Mitigation lift: {signedPct0(r.mitigation_lift)}{" "}
                        <span className="opacity-70">
                          (CI {signedPct0(r.mitigation_ci_low)}–{signedPct0(r.mitigation_ci_high)})
                        </span>
                        <span className="ml-1 opacity-70">• negative = mitigations help</span>
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {rows.length === 0 && (
          <p className="text-sm opacity-70">
            No historical statistics yet (collect more changes/incidents).
          </p>
        )}
      </div>
    </div>
  );
}
