import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { IntegrationHealthService } from "@/modules/integrations";

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const admin = createAdminClient();

  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const orgId = req.nextUrl.searchParams.get("orgId");
  if (!orgId) {
    return NextResponse.json({ error: "orgId required" }, { status: 400 });
  }

  const { data: member } = await supabase
    .from("organization_members")
    .select("org_id")
    .eq("org_id", orgId)
    .eq("user_id", userRes.user.id)
    .maybeSingle();

  if (!member) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: install } = await admin
    .from("slack_installations")
    .select("bot_token, team_id, team_name, status")
    .eq("org_id", orgId)
    .maybeSingle();

  if (!install || (install as { status?: string }).status !== "ACTIVE") {
    return NextResponse.json(
      { error: "Slack not connected" },
      { status: 400 }
    );
  }

  const botToken = (install as { bot_token?: string }).bot_token;
  if (!botToken) {
    return NextResponse.json(
      { error: "No bot token" },
      { status: 400 }
    );
  }

  const res = await fetch("https://slack.com/api/auth.test", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${botToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({}),
  });

  const json = (await res.json()) as { ok?: boolean; team?: string; error?: string };
  const healthSvc = new IntegrationHealthService(admin);

  if (!json?.ok) {
    const msg = json?.error ?? "Auth test failed";
    await healthSvc.markError(orgId, "slack", msg);
    return NextResponse.json({ error: msg }, { status: 502 });
  }

  await healthSvc.markHealthy(orgId, "slack");

  return NextResponse.json({
    status: "ok",
    teamName: (install as { team_name?: string }).team_name ?? (json as { team?: string }).team ?? null,
  });
}
