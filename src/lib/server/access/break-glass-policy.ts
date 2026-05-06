import { env } from "@/lib/env";

export function breakGlassApprovalsRequired(severity: "high" | "critical"): number {
  if (env.solvrenEmergencyMode) return 1;
  return severity === "critical" ? 2 : 1;
}
