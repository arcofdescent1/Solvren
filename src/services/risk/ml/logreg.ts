function sigmoid(z: number) {
  if (z > 20) return 1;
  if (z < -20) return 0;
  return 1 / (1 + Math.exp(-z));
}

function dot(w: number[], x: number[]) {
  let s = 0;
  for (let i = 0; i < w.length; i++) s += w[i] * x[i];
  return s;
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export type LogRegTrainOptions = {
  lr?: number;
  steps?: number;
  l2?: number;
  maxFeatures?: number;
};

export type LogRegModel = {
  intercept: number;
  weights: Record<string, number>;
  features: string[];
  trainedAt: string;
  metrics: {
    sampleSize: number;
    posRate: number;
    loss: number;
    brier: number;
  };
};

export function trainLogReg(
  rows: Array<{ y: 0 | 1; x: Record<string, number> }>,
  opts: LogRegTrainOptions = {}
): LogRegModel | null {
  const lr = opts.lr ?? 0.15;
  const steps = opts.steps ?? 400;
  const l2 = opts.l2 ?? 0.01;
  const maxFeatures = opts.maxFeatures ?? 200;

  if (rows.length < 200) return null;

  const freq = new Map<string, number>();
  let pos = 0;
  for (const r of rows) {
    if (r.y === 1) pos++;
    for (const k of Object.keys(r.x)) freq.set(k, (freq.get(k) ?? 0) + 1);
  }

  const features = Array.from(freq.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxFeatures)
    .map(([k]) => k)
    .sort();

  const m = rows.length;
  const d = features.length;

  let b = Math.log((pos + 1) / (m - pos + 1));
  const w = new Array(d).fill(0);

  const X: number[][] = new Array(m);
  const Y: number[] = new Array(m);
  for (let i = 0; i < m; i++) {
    const xi = new Array(d).fill(0);
    const src = rows[i].x;
    for (let j = 0; j < d; j++) {
      const k = features[j];
      const v = src[k];
      if (v != null) xi[j] = Number(v);
    }
    X[i] = xi;
    Y[i] = rows[i].y;
  }

  for (let step = 0; step < steps; step++) {
    let gb = 0;
    const gw = new Array(d).fill(0);

    for (let i = 0; i < m; i++) {
      const p = sigmoid(b + dot(w, X[i]));
      const err = p - Y[i];
      gb += err;
      for (let j = 0; j < d; j++) {
        gw[j] += err * X[i][j];
      }
    }

    gb /= m;
    for (let j = 0; j < d; j++) {
      gw[j] = gw[j] / m + l2 * w[j];
    }

    b -= lr * gb;
    for (let j = 0; j < d; j++) w[j] -= lr * gw[j];
  }

  let loss = 0;
  let brier = 0;
  for (let i = 0; i < m; i++) {
    const p = clamp(sigmoid(b + dot(w, X[i])), 1e-6, 1 - 1e-6);
    const y = Y[i];
    loss += -(y * Math.log(p) + (1 - y) * Math.log(1 - p));
    brier += (p - y) ** 2;
  }
  loss /= m;
  brier /= m;

  const weights: Record<string, number> = {};
  for (let j = 0; j < d; j++) weights[features[j]] = w[j];

  return {
    intercept: b,
    weights,
    features,
    trainedAt: new Date().toISOString(),
    metrics: {
      sampleSize: m,
      posRate: pos / m,
      loss,
      brier,
    },
  };
}

export function predictLogReg(model: LogRegModel, x: Record<string, number>) {
  let z = model.intercept;
  for (const k of model.features) {
    const v = x[k];
    if (v != null) z += model.weights[k] * Number(v);
  }
  return sigmoid(z);
}
