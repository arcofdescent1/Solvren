import type { SupabaseClient } from "@supabase/supabase-js";
import { predictLogReg, type LogRegModel } from "@/services/risk/ml/logreg";

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export async function loadOrgModel(
  supabase: SupabaseClient,
  args: { orgId: string; domainKey: string }
): Promise<LogRegModel | null> {
  const { data, error } = await supabase
    .from("org_models")
    .select("coefficients, metrics")
    .eq("org_id", args.orgId)
    .eq("domain", args.domainKey)
    .eq("model_key", "LOGREG_V1")
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  const c = (data as { coefficients?: { intercept?: number; weights?: Record<string, number>; features?: string[] } })
    .coefficients ?? {};
  const features = Array.isArray(c.features) ? c.features : [];
  const weights = c.weights ?? {};
  const intercept = Number(c.intercept ?? 0);

  if (!features.length) return null;

  const metrics = (data as { metrics?: { sampleSize?: number; posRate?: number; loss?: number; brier?: number } })
    .metrics ?? {};

  return {
    intercept,
    weights,
    features,
    trainedAt: new Date().toISOString(),
    metrics: {
      sampleSize: Number(metrics.sampleSize ?? 0),
      posRate: Number(metrics.posRate ?? 0),
      loss: Number(metrics.loss ?? 0),
      brier: Number(metrics.brier ?? 0),
    },
  };
}

export function blendBayesAndML(args: {
  bayesMean: number;
  bayesConfidence: number;
  mlProb?: number | null;
  mlSampleSize?: number | null;
}) {
  const bayes = clamp(args.bayesMean, 0, 1);
  const ml = args.mlProb == null ? null : clamp(args.mlProb, 0, 1);

  if (ml == null) return { final: bayes, alpha: 0, ml: null as number | null };

  const n = Math.max(0, Number(args.mlSampleSize ?? 0));
  const mlTrust = clamp(n / (n + 600), 0, 0.6);
  const bayesTrust = clamp(args.bayesConfidence, 0, 1);

  const alpha = clamp(mlTrust * (1 - 0.5 * bayesTrust), 0, 0.6);

  const final = (1 - alpha) * bayes + alpha * ml;
  return { final: clamp(final, 0, 1), alpha, ml };
}

export function predictWithModel(model: LogRegModel, x: Record<string, number>) {
  return predictLogReg(model, x);
}
