/**
 * POST /api/integrations/github/connect/start
 * Returns GitHub App installation URL for the connect flow.
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdminLikeRole, parseOrgRole } from "@/lib/rbac/roles";
import { env } from "@/lib/env";
import { randomBytes } from "crypto";

export async function POST(req: NextRequest) {
  if (!env.githubEnabled) {
    return NextResponse.json({ error: "GitHub integration not configured" }, { status: 503 });
  }

  const supabase = await createServerSupabaseClient();
  const admin = createAdminClient();

  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { organizationId?: string };
  try {
    body = (await req.json()) as { organizationId?: string };
  } catch {
    body = {};
  }
  const orgId = body.organizationId ?? req.nextUrl.searchParams.get("organizationId");

  if (!orgId) {
    return NextResponse.json({ error: "organizationId required" }, { status: 400 });
  }

  const { data: member } = await supabase
    .from("organization_members")
    .select("role")
    .eq("org_id", orgId)
    .eq("user_id", userRes.user.id)
    .maybeSingle();

  if (!member || !isAdminLikeRole(parseOrgRole((member as { role?: string }).role ?? null))) {
    return NextResponse.json({ error: "Admin required" }, { status: 403 });
  }

  const state = randomBytes(32).toString("hex");

  await admin.from("github_connect_sessions").insert({
    state,
    org_id: orgId,
  });

  const appName = env.githubAppName ?? "Solvren";
  const installUrl = `https://github.com/apps/${encodeURIComponent(appName)}/installations/new?state=${state}`;

  return NextResponse.json({ installUrl });
}
