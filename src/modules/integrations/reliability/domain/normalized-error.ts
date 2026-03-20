/**
 * Gap 4 — Normalized error for integration adapters (§10.1).
 */
export type NormalizedErrorCategory = "transient" | "permanent" | "auth" | "rate_limit";

export type NormalizedError = {
  code: string;
  category: NormalizedErrorCategory;
  message: string;
  httpStatus?: number;
};
