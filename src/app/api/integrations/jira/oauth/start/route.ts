import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { env } from "@/lib/env";
import { authStateFromUser, requireVerifiedResponse } from "@/lib/auth";
import { JiraAuthService } from "@/services/jira/jiraAuthService";

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const forbidden = requireVerifiedResponse(authStateFromUser(userRes.user));
  if (forbidden) return forbidden;

  let body: { organizationId?: string; returnTo?: string };
  try {
    body = (await req.json()) as { organizationId?: string; returnTo?: string };
  } catch {
    body = {};
  }
  const orgId = body.organizationId ?? req.nextUrl.searchParams.get("orgId");

  if (!orgId) {
    return NextResponse.json({ error: "organizationId required" }, { status: 400 });
  }

  const { data: mem } = await supabase
    .from("organization_members")
    .select("org_id, role")
    .eq("org_id", orgId)
    .eq("user_id", userRes.user.id)
    .maybeSingle();

  if (!mem) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const adminRoles = ["owner", "admin"];
  if (!adminRoles.includes((mem as { role?: string }).role ?? "")) {
    return NextResponse.json({ error: "Admin required" }, { status: 403 });
  }

  const admin = createAdminClient();
  const authService = new JiraAuthService(admin);
  let authorizeUrl: string;
  try {
    authorizeUrl = authService.buildAuthorizeUrl(orgId, userRes.user.id, env.appUrl, {
      returnTo: body.returnTo,
    });
  } catch {
    return NextResponse.json(
      { error: "jira_not_configured" },
      { status: 500 }
    );
  }

  return NextResponse.json({ authorizeUrl });
}
