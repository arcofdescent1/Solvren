export type ExposureBucket = "NONE" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export function exposureBucketFromChange(change: {
  estimated_mrr_affected?: number | null;
  percent_customer_base_affected?: number | null;
}): ExposureBucket {
  const mrr = Number(change.estimated_mrr_affected ?? 0);
  const pct = Number(change.percent_customer_base_affected ?? 0);

  // Simple & explainable thresholds (tune later)
  if (mrr <= 0 && pct <= 0) return "NONE";
  if (mrr < 2000 && pct < 1) return "LOW";
  if (mrr < 10000 && pct < 5) return "MEDIUM";
  if (mrr < 50000 && pct < 15) return "HIGH";
  return "CRITICAL";
}
