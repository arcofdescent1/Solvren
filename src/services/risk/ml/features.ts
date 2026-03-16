import { exposureBucketFromChange } from "@/services/risk/exposureBuckets";

export function featuresForChange(args: {
  change: { estimated_mrr_affected?: number | null; percent_customer_base_affected?: number | null };
  domainKey: string;
  signalKeys: string[];
}) {
  const x: Record<string, number> = {};

  const bucket = exposureBucketFromChange(args.change);
  x[`bucket:${bucket}`] = 1;

  x[`domain:${args.domainKey}`] = 1;

  for (const s of args.signalKeys) x[`signal:${s}`] = 1;

  return x;
}
