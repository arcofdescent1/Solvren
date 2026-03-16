/**
 * POST /api/integrations/github/retry-failures
 * Queue retry of failed webhook events (processes github_webhook_events with error).
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdminLikeRole, parseOrgRole } from "@/lib/rbac/roles";
import { env } from "@/lib/env";

export async function POST(req: NextRequest) {
  if (!env.githubEnabled) {
    return NextResponse.json({ error: "GitHub integration not configured" }, { status: 503 });
  }

  const supabase = await createServerSupabaseClient();
  const admin = createAdminClient();

  const orgId = req.nextUrl.searchParams.get("orgId");
  if (!orgId) return NextResponse.json({ error: "orgId required" }, { status: 400 });

  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: member } = await supabase
    .from("organization_members")
    .select("role")
    .eq("org_id", orgId)
    .eq("user_id", userRes.user.id)
    .maybeSingle();

  if (!member || !isAdminLikeRole(parseOrgRole((member as { role?: string }).role ?? null))) {
    return NextResponse.json({ error: "Admin required" }, { status: 403 });
  }

  const { data: failed } = await admin
    .from("github_webhook_events")
    .select("id")
    .eq("org_id", orgId)
    .eq("processed", false)
    .not("error_message", "is", null)
    .limit(100);

  const ids = (failed ?? []).map((r) => (r as { id: string }).id);
  if (ids.length === 0) {
    return NextResponse.json({ queued: 0 });
  }

  await admin
    .from("github_webhook_events")
    .update({ error_message: null, error_code: null })
    .in("id", ids);

  return NextResponse.json({ queued: ids.length });
}
