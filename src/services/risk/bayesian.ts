function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function zForCredibleMass(mass: number) {
  if (Math.abs(mass - 0.9) < 1e-6) return 1.6448536269514722;
  if (Math.abs(mass - 0.95) < 1e-6) return 1.959963984540054;
  return 1.6448536269514722;
}

export function betaPosteriorFromCounts(args: {
  total: number;
  incidents: number;
  priorAlpha?: number;
  priorBeta?: number;
  credibleMass?: number;
}) {
  const total = Math.max(0, Math.floor(args.total));
  const incidents = Math.max(0, Math.min(total, Math.floor(args.incidents)));

  const priorAlpha = args.priorAlpha ?? 1;
  const priorBeta = args.priorBeta ?? 19;
  const credibleMass = args.credibleMass ?? 0.9;

  const alpha = priorAlpha + incidents;
  const beta = priorBeta + (total - incidents);

  const mean = alpha / (alpha + beta);

  const denom = (alpha + beta) ** 2 * (alpha + beta + 1);
  const variance = denom > 0 ? (alpha * beta) / denom : 0;
  const sd = Math.sqrt(Math.max(variance, 0));

  const z = zForCredibleMass(credibleMass);

  const nEff = alpha + beta;
  const widen = nEff < 30 ? 1.8 : 1.0;

  const low = clamp(mean - z * sd * widen, 0, 1);
  const high = clamp(mean + z * sd * widen, 0, 1);

  const intervalWidth = Math.max(1e-9, high - low);
  const confidence = clamp((nEff / (nEff + 50)) * (1 - intervalWidth), 0, 1);

  return { alpha, beta, mean, ciLow: low, ciHigh: high, confidence };
}

export function mitigationLiftBayes(args: {
  appliedTotal: number;
  appliedIncidents: number;
  controlTotal: number;
  controlIncidents: number;
  priorAlpha?: number;
  priorBeta?: number;
  credibleMass?: number;
}) {
  const priorAlpha = args.priorAlpha ?? 1;
  const priorBeta = args.priorBeta ?? 19;
  const credibleMass = args.credibleMass ?? 0.9;

  const a = betaPosteriorFromCounts({
    total: args.appliedTotal,
    incidents: args.appliedIncidents,
    priorAlpha,
    priorBeta,
    credibleMass,
  });

  const c = betaPosteriorFromCounts({
    total: args.controlTotal,
    incidents: args.controlIncidents,
    priorAlpha,
    priorBeta,
    credibleMass,
  });

  const eps = 1e-6;
  const liftMean = (a.mean - c.mean) / Math.max(c.mean, eps);

  const liftLow = (a.ciLow - c.ciHigh) / Math.max(c.ciHigh, eps);
  const liftHigh = (a.ciHigh - c.ciLow) / Math.max(c.ciLow, eps);

  return {
    liftMean,
    liftLow: Math.min(liftLow, liftHigh),
    liftHigh: Math.max(liftLow, liftHigh),
    applied: a,
    control: c,
  };
}
