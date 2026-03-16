function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

const Z_90 = 1.6448536269514722;

export function betaPosteriorFromEffectiveCounts(args: {
  effTotal: number; // can be fractional
  effIncidents: number; // can be fractional
  priorAlpha?: number;
  priorBeta?: number;
  credibleZ?: number; // default 90%
}) {
  const priorAlpha = args.priorAlpha ?? 1;
  const priorBeta = args.priorBeta ?? 19;
  const z = args.credibleZ ?? Z_90;

  const effTotal = Math.max(0, Number(args.effTotal));
  const effInc = clamp(Number(args.effIncidents), 0, effTotal);

  const alpha = priorAlpha + effInc;
  const beta = priorBeta + (effTotal - effInc);

  const mean = alpha / (alpha + beta);

  // Approx variance works for fractional alpha/beta too.
  const denom = (alpha + beta) ** 2 * (alpha + beta + 1);
  const variance = denom > 0 ? (alpha * beta) / denom : 0;
  const sd = Math.sqrt(Math.max(variance, 0));

  // Wider if effective sample is low
  const nEff = alpha + beta;
  const widen = nEff < 30 ? 1.8 : 1.0;

  const low = clamp(mean - z * sd * widen, 0, 1);
  const high = clamp(mean + z * sd * widen, 0, 1);

  const intervalWidth = Math.max(1e-9, high - low);
  const confidence = clamp((nEff / (nEff + 50)) * (1 - intervalWidth), 0, 1);

  return { alpha, beta, mean, ciLow: low, ciHigh: high, confidence };
}
