import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { auditLog } from "@/lib/audit";
import { recomputeSignalStatsRevenueAware } from "@/services/risk/recomputeSignalStats";
import { rescoreRevenueChange } from "@/services/risk/rescoreChange";
import { isAdminLikeRole, parseOrgRole } from "@/lib/rbac/roles";

const GLOBAL_ORG_ID = "00000000-0000-0000-0000-000000000000";

export async function POST(req: Request) {
  const supa = await createServerSupabaseClient();
  const { data: userRes } = await supa.auth.getUser();
  if (!userRes.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as { windowDays?: number; revenueAware?: boolean } | null;
  const windowDays = Number(body?.windowDays ?? 14);
  const revenueAware = body?.revenueAware !== false;

  const { data: membership } = await supa
    .from("organization_members")
    .select("org_id, role")
    .eq("user_id", userRes.user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!membership || !isAdminLikeRole(parseOrgRole((membership as { role?: string | null }).role ?? null))) {
    return NextResponse.json({ error: "Owner/Admin role required" }, { status: 403 });
  }

  const orgId = membership.org_id as string;

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json(
      { error: "Admin client not configured (SUPABASE_SERVICE_ROLE_KEY)" },
      { status: 500 }
    );
  }

  const { error } = await admin.rpc("recompute_signal_statistics", { window_days: windowDays });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let revenueStats: { signals?: number } | null = null;
  let rescored = 0;

  if (revenueAware) {
    revenueStats = await recomputeSignalStatsRevenueAware(admin, {
      orgId,
      domain: "REVENUE",
      modelVersion: 1,
    });

    const days = 90;
    const sinceIso = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    const { data: changes } = await admin
      .from("change_events")
      .select("id, status")
      .eq("org_id", orgId)
      .eq("domain", "REVENUE")
      .gte("submitted_at", sinceIso)
      .limit(500);

    for (const c of changes ?? []) {
      const status = String((c as { status?: string }).status ?? "");
      if (["APPROVED", "REJECTED", "CLOSED", "RESOLVED"].includes(status)) continue;
      try {
        await rescoreRevenueChange(admin, {
          changeId: (c as { id: string }).id,
          orgId,
        });
        rescored += 1;
      } catch {
        // continue
      }
    }
  }

  await auditLog(supa, {
    orgId: GLOBAL_ORG_ID,
    actorId: userRes.user.id,
    action: "learning_recompute_manual",
    entityType: "learning",
    entityId: null,
    metadata: { windowDays, revenueAware, orgId, rescored },
  });

  return NextResponse.json({
    ok: true,
    revenueAware,
    revenueStats: revenueStats ?? undefined,
    rescored,
  });
}
