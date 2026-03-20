/**
 * Phase 6 — GET /api/execution/available-actions.
 * Returns actions available for execution (filtered by connected integrations when orgId provided).
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { listAllActions } from "@/modules/execution/registry/action-registry";
import { getAccountsByOrg } from "@/modules/integrations/core/integrationAccountsRepo";

export async function GET(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const orgId = searchParams.get("orgId");

  const allActions = listAllActions();

  if (orgId) {
    const { data: accounts } = await getAccountsByOrg(supabase, orgId);
    const connected = new Set(
      (accounts ?? []).filter((a) => a.provider && (a.status === "connected" || a.status === "degraded")).map((a) => a.provider)
    );
    const filtered = allActions.filter((a) => connected.has(a.provider));
    return NextResponse.json({ actions: filtered });
  }

  return NextResponse.json({ actions: allActions });
}
