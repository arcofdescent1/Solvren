/**
 * Phase 3 — Slack/email eligibility (severity-only rules superseded for detector issues).
 */
export function shouldNotifyIssuePhase3(row: {
  priority_band?: string | null;
  noise_score?: number | null;
  suppressed_until?: string | null;
}): boolean {
  const sup = row.suppressed_until;
  if (sup && Date.parse(sup) > Date.now()) return false;
  const band = String(row.priority_band ?? "").toLowerCase();
  if (band !== "critical" && band !== "high") return false;
  const noise = Number(row.noise_score ?? 0);
  if (!Number.isFinite(noise) || noise >= 70) return false;
  return true;
}
