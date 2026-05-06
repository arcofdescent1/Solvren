/**
 * Phase 5 — route guard: until onboarding COMPLETE, only specific routes are reachable.
 * Full block list (ROI, executive, restricted settings); partial allow for integrations + profile (§ route matrix).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { recomputeOnboardingState, getOnboardingState } from "./onboardingStateService";

function isBlockedUntilOnboardingComplete(pathname: string): boolean {
  const p = pathname.split("?")[0] ?? "";
  if (!p) return false;
  if (p === "/executive" || p.startsWith("/executive/")) return true;
  if (p === "/roi" || p.startsWith("/roi/")) return true;
  if (p === "/insights/roi" || p.startsWith("/insights/roi/")) return true;
  if (p.startsWith("/api/executive")) return true;
  if (p.startsWith("/api/roi")) return true;
  if (p.startsWith("/settings/billing")) return true;
  if (p.startsWith("/settings/system")) return true;
  if (p.startsWith("/settings/admin")) return true;
  return false;
}

function pathAllowedDuringOnboarding(pathname: string): boolean {
  if (isBlockedUntilOnboardingComplete(pathname)) return false;
  const p = pathname.split("?")[0] ?? "";
  if (!p) return false;
  const allowed = [
    "/onboarding",
    "/action-queue",
    "/issues",
    "/integrations",
    "/marketplace/integrations",
    "/dashboard",
    "/home",
    "/changes",
    "/login",
    "/auth",
    "/settings/organization",
    "/settings",
    "/org/settings",
  ];
  for (const a of allowed) {
    if (p === a || p.startsWith(`${a}/`)) return true;
  }
  return false;
}

export async function shouldRedirectToPhase5Onboarding(
  supabase: SupabaseClient,
  orgId: string,
  pathname: string
): Promise<boolean> {
  if (pathAllowedDuringOnboarding(pathname)) return false;
  await recomputeOnboardingState(supabase, orgId);
  const row = await getOnboardingState(supabase, orgId);
  const step = row?.current_step ?? "CONNECT_INTEGRATION";
  return step !== "COMPLETE";
}
