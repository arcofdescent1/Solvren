/**
 * POST /api/integrations/github/test
 * Test GitHub connection: verify installation and repo access.
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdminLikeRole, parseOrgRole } from "@/lib/rbac/roles";
import { GitHubClient } from "@/services/github/GitHubClient";
import { env } from "@/lib/env";

export async function POST(req: NextRequest) {
  if (!env.githubEnabled) {
    return NextResponse.json({ error: "GitHub integration not configured" }, { status: 503 });
  }

  const supabase = await createServerSupabaseClient();
  const admin = createAdminClient();

  const orgId = req.nextUrl.searchParams.get("orgId");
  if (!orgId) {
    return NextResponse.json({ error: "orgId required" }, { status: 400 });
  }

  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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

  const { data: inst } = await admin
    .from("github_installations")
    .select("github_installation_id")
    .eq("org_id", orgId)
    .maybeSingle();

  if (!inst) {
    return NextResponse.json({ error: "GitHub not connected" }, { status: 400 });
  }

  const installationId = (inst as { github_installation_id: number }).github_installation_id;

  try {
    const client = new GitHubClient(installationId);
    const installation = await client.getInstallation();
    const login = installation.account?.login ?? "unknown";

    return NextResponse.json({
      status: "ok",
      installationLogin: login,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Test failed";
    return NextResponse.json(
      { status: "error", error: msg },
      { status: 500 }
    );
  }
}
