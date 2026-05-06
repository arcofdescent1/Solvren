/**
 * Phase 2 — Reduce financial sensitivity while preserving prioritization signal.
 */

function roundToStep(n: number, step: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.round(n / step) * step;
}

export function valueBandLabel(rounded: number): string {
  if (!Number.isFinite(rounded) || rounded <= 0) return "0";
  const step = 5000;
  const low = Math.floor(rounded / step) * step;
  const high = low + step;
  return `${low}-${high}`;
}

/** Mutates numeric leaves that look like currency amounts (shallow + common nested `properties`). */
export function applyFinancialMinimization(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...obj };
  const moneyKeys = /^(amount|total|amount_due|amount_remaining|subtotal|tax|price|balance)$/i;

  const minimize = (key: string, val: unknown) => {
    if (typeof val !== "number" || !Number.isFinite(val)) return val;
    if (!moneyKeys.test(key)) return val;
    const rounded = roundToStep(val, 1000);
    return rounded;
  };

  for (const key of Object.keys(out)) {
    out[key] = minimize(key, out[key]);
    if (key === "properties" && out.properties && typeof out.properties === "object" && !Array.isArray(out.properties)) {
      const props = { ...(out.properties as Record<string, unknown>) };
      for (const pk of Object.keys(props)) {
        const v = minimize(pk, props[pk]);
        props[pk] = v;
        if (typeof v === "number" && moneyKeys.test(pk)) {
          props[`${pk}_band`] = valueBandLabel(v);
        }
      }
      out.properties = props;
    }
    if (typeof out[key] === "number" && moneyKeys.test(key)) {
      out[`${key}_band`] = valueBandLabel(out[key] as number);
    }
  }

  return out;
}
