import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getActiveOrg } from "@/lib/org/activeOrg";
import { getOrgOnboardingState } from "@/modules/onboarding/repositories/org-onboarding-states.repository";
import { meetsPhase3EntryConditions } from "@/modules/onboarding/phase3/phase3-entry.service";
import { meetsPhase4EntryConditions } from "@/modules/onboarding/phase4/phase4-entry.service";
import { phase4Thresholds } from "@/modules/onboarding/phase4/phase4-thresholds";
import { planFromString } from "@/services/billing/entitlements";
import { AppShellClient } from "./AppShellClient";

export async function AppShell({ children }: { children: React.ReactNode }) {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase.auth.getUser();

  if (!data.user) {
    return (
      <AppShellClient
        user={null}
        memberships={[]}
        activeOrgId={null}
        unreadCount={0}
        myWorkCount={0}
        needsReviewCount={0}
      >
        {children}
      </AppShellClient>
    );
  }

  const [
    { count: unreadCount },
    { activeOrgId, memberships },
    { count: needsReviewCount },
    { count: myIssueCount },
  ] = await Promise.all([
    supabase
      .from("in_app_notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", data.user.id)
      .is("read_at", null)
      .then((r) => ({ count: r.count ?? 0 })),
    getActiveOrg(supabase, data.user.id),
    (async () => {
      try {
        const r = await supabase
          .from("approvals")
          .select("id", { count: "exact", head: true })
          .eq("approver_user_id", data.user.id)
          .eq("decision", "PENDING");
        return { count: r.count ?? 0 };
      } catch {
        return { count: 0 };
      }
    })(),
    (async () => {
      try {
        const r = await supabase
          .from("issues")
          .select("id", { count: "exact", head: true })
          .eq("owner_user_id", data.user.id)
          .in("status", ["open", "triaged", "assigned", "in_progress", "resolved"]);
        return { count: r.count ?? 0 };
      } catch {
        return { count: 0 };
      }
    })(),
  ]);
  const myWorkCount = (needsReviewCount ?? 0) + (myIssueCount ?? 0);

  let phase3Banner: { show: boolean; phase3Status: string | null; eligible: boolean } | null = null;
  let isDemoOrg = false;
  if (activeOrgId) {
    const { data: orgDemo } = await supabase.from("organizations").select("is_demo").eq("id", activeOrgId).maybeSingle();
    isDemoOrg = Boolean((orgDemo as { is_demo?: boolean } | null)?.is_demo);
  }

  let phase4Banner: {
    show: boolean;
    phase4Status: string | null;
    cadenceReminder: boolean;
    executiveStreak: number;
    executiveTarget: number;
  } | null = null;
  if (activeOrgId) {
    const { data: obs } = await supabase
      .from("org_onboarding_states")
      .select("phase2_status, phase3_status")
      .eq("org_id", activeOrgId)
      .maybeSingle();
    const row = obs as { phase2_status?: string | null; phase3_status?: string | null } | null;
    if (row?.phase2_status === "COMPLETED" && row.phase3_status !== "COMPLETED" && row.phase3_status !== "SKIPPED") {
      const admin = createAdminClient();
      const { data: fullRow } = await getOrgOnboardingState(admin, activeOrgId);
      const eligible = await meetsPhase3EntryConditions(admin, activeOrgId, fullRow);
      phase3Banner = { show: true, phase3Status: row.phase3_status ?? "NOT_STARTED", eligible };
    } else if (row?.phase3_status === "COMPLETED") {
      const admin = createAdminClient();
      const { data: fullRow } = await getOrgOnboardingState(admin, activeOrgId);
      const eligible4 = await meetsPhase4EntryConditions(admin, activeOrgId, fullRow);
      const st = fullRow?.phase4_status ?? "NOT_STARTED";
      const terminal4 = st === "COMPLETED" || st === "SKIPPED";
      if (eligible4 && !terminal4) {
        const { data: billing } = await admin
          .from("billing_accounts")
          .select("plan_key")
          .eq("org_id", activeOrgId)
          .maybeSingle();
        const plan = planFromString((billing as { plan_key?: string } | null)?.plan_key);
        const t = phase4Thresholds(plan);
        const streak = fullRow?.phase4_consecutive_executive_weeks ?? 0;
        phase4Banner = {
          show: true,
          phase4Status: st,
          cadenceReminder: streak < t.consecutiveExecutiveWeeks,
          executiveStreak: streak,
          executiveTarget: t.consecutiveExecutiveWeeks,
        };
      }
    }
  }

  return (
    <AppShellClient
      user={{ id: data.user.id, email: data.user.email ?? undefined }}
      memberships={memberships}
      activeOrgId={activeOrgId}
      unreadCount={unreadCount ?? 0}
      myWorkCount={myWorkCount}
      needsReviewCount={needsReviewCount ?? 0}
      phase3Banner={phase3Banner}
      phase4Banner={phase4Banner}
      isDemoOrg={isDemoOrg}
    >
      {children}
    </AppShellClient>
  );
}
