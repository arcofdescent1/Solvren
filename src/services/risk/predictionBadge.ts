import type { SupabaseClient } from "@supabase/supabase-js";

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function uniq(arr: string[]) {
  return Array.from(new Set(arr.filter(Boolean)));
}

function weightNorm(w?: number | null) {
  // Mild normalization: map weight ~0.3..3.0 -> factor ~0.6..1.4
  const x = Number(w ?? 1);
  const clamped = clamp(x, 0.3, 3.0);
  // linear mapping
  return 0.6 + ((clamped - 0.3) / (3.0 - 0.3)) * (1.4 - 0.6);
}

export async function getPredictionBadgeForChange(
  supabase: SupabaseClient,
  args: {
    orgId: string;
    changeId: string;
    domainKey: string;
    detectedSignals: Array<{ signalKey: string; weight?: number | null }> | string[];
    /** When set, use signal_stats_buckets with decayed Bayesian (bayes_d_*) for exposure-aware prediction */
    exposureBucket?: string | null;
  }
) {
  const { orgId, domainKey, detectedSignals, exposureBucket } = args;

  const signalKeys =
    typeof (detectedSignals as unknown[])[0] === "string"
      ? uniq(detectedSignals as string[])
      : uniq((detectedSignals as Array<{ signalKey: string }>).map((s) => s.signalKey));

  if (!signalKeys.length) {
    return {
      mean: 0,
      ciLow: 0,
      ciHigh: 0,
      confidence: 0,
      components: [],
    };
  }

  const useBucketed = Boolean(exposureBucket);

  let stats: Record<string, unknown>[] | null = null;
  let useBucketedActual = useBucketed;

  if (useBucketed) {
    const res = await supabase
      .from("signal_stats_buckets")
      .select("signal_key, bayes_d_mean, bayes_d_ci_low, bayes_d_ci_high, bayes_d_confidence")
      .eq("org_id", orgId)
      .eq("domain", domainKey)
      .eq("exposure_bucket", exposureBucket!)
      .in("signal_key", signalKeys);
    if (res.error) throw new Error(res.error.message);
    stats = res.data;
    if ((stats ?? []).length === 0) useBucketedActual = false;
  }

  if (!useBucketedActual) {
    const res = await supabase
      .from("signal_stats")
      .select("signal_key, bayes_mean, bayes_ci_low, bayes_ci_high, bayes_confidence")
      .eq("org_id", orgId)
      .eq("domain", domainKey)
      .eq("model_version", 1)
      .in("signal_key", signalKeys);
    if (res.error) throw new Error(res.error.message);
    stats = res.data;
  }

  const meanKey = useBucketedActual ? "bayes_d_mean" : "bayes_mean";
  const lowKey = useBucketedActual ? "bayes_d_ci_low" : "bayes_ci_low";
  const highKey = useBucketedActual ? "bayes_d_ci_high" : "bayes_ci_high";
  const confKey = useBucketedActual ? "bayes_d_confidence" : "bayes_confidence";

  const byKey = new Map<string, Record<string, number>>(
    (stats ?? []).map((r: Record<string, unknown>) => [
      String(r.signal_key),
      {
        bayes_mean: Number(r[meanKey] ?? 0),
        bayes_ci_low: Number(r[lowKey] ?? 0),
        bayes_ci_high: Number(r[highKey] ?? 0),
        bayes_confidence: Number(r[confKey] ?? 0),
      },
    ])
  );

  const components = signalKeys.map((k) => {
    const s = byKey.get(k);
    const mean = clamp(Number(s?.bayes_mean ?? 0), 0, 1);
    const low = clamp(Number(s?.bayes_ci_low ?? 0), 0, 1);
    const high = clamp(Number(s?.bayes_ci_high ?? 0), 0, 1);
    const conf = clamp(Number(s?.bayes_confidence ?? 0), 0, 1);

    const w =
      typeof (detectedSignals as unknown[])[0] === "string"
        ? 1
        : weightNorm((detectedSignals as Array<{ signalKey: string; weight?: number | null }>).find((x) => x.signalKey === k)?.weight);

    return { signalKey: k, mean, low, high, confidence: conf, weightFactor: w };
  });

  // Combine probabilities: 1 - product(1 - p_i * w_i)
  const prod = (vals: number[]) => vals.reduce((acc, v) => acc * v, 1);

  const mean = 1 - prod(components.map((c) => 1 - clamp(c.mean * c.weightFactor, 0, 1)));
  const ciLow = 1 - prod(components.map((c) => 1 - clamp(c.low * c.weightFactor, 0, 1)));
  const ciHigh = 1 - prod(components.map((c) => 1 - clamp(c.high * c.weightFactor, 0, 1)));

  // Confidence: average component confidence, slightly penalize if interval is wide
  const avgConf = components.reduce((a, c) => a + c.confidence, 0) / Math.max(1, components.length);
  const width = Math.max(0, ciHigh - ciLow);
  const confidence = clamp(avgConf * (1 - width), 0, 1);

  return { mean: clamp(mean, 0, 1), ciLow: clamp(ciLow, 0, 1), ciHigh: clamp(ciHigh, 0, 1), confidence, components };
}
