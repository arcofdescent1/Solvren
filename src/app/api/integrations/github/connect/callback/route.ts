/**
 * GET /api/integrations/github/connect/callback
 * GitHub App post-installation callback. GitHub redirects here with installation_id and state.
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { auditLog } from "@/lib/audit";
import { IntegrationHealthService } from "@/modules/integrations";
import { syncInstallation, syncRepositories } from "@/services/github/GitHubInstallationService";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const installationIdParam = searchParams.get("installation_id");
  const setupAction = searchParams.get("setup_action");
  const state = searchParams.get("state");

  const baseUrl = new URL("/org/settings/integrations/github", req.url).origin;
  const errorUrl = (msg: string) => `${baseUrl}?error=${encodeURIComponent(msg)}`;
  const successUrl = (orgId: string) => `${baseUrl}?orgId=${orgId}&connected=1`;

  if (!state || !installationIdParam) {
    return NextResponse.redirect(errorUrl("missing_state_or_installation_id"));
  }

  const installationId = parseInt(installationIdParam, 10);
  if (isNaN(installationId)) {
    return NextResponse.redirect(errorUrl("invalid_installation_id"));
  }

  const admin = createAdminClient();
  const supabase = await createServerSupabaseClient();

  const { data: session, error: sessErr } = await admin
    .from("github_connect_sessions")
    .select("org_id")
    .eq("state", state)
    .maybeSingle();

  if (sessErr || !session) {
    return NextResponse.redirect(errorUrl("invalid_state"));
  }

  const orgId = (session as { org_id: string }).org_id;

  await admin.from("github_connect_sessions").delete().eq("state", state);

  try {
    const { GitHubClient } = await import("@/services/github/GitHubClient");
    const client = new GitHubClient(installationId);
    const inst = await client.getInstallation();

    const accountLogin = inst.account?.login ?? "unknown";
    const accountType = (inst.account?.type === "Organization" ? "Organization" : "User") as "User" | "Organization";

    const { connectionId } = await syncInstallation(
      admin,
      orgId,
      installationId,
      accountLogin,
      accountType
    );

    await syncRepositories(admin, orgId, installationId);

    await admin
      .from("integration_connections")
      .update({
        config: { installationId, accountLogin, accountType },
        status: "connected",
      })
      .eq("id", connectionId);

    const healthSvc = new IntegrationHealthService(admin);
    await healthSvc.markHealthy(orgId, "github");

    await auditLog(supabase, {
      orgId,
      actorId: (await supabase.auth.getUser()).data.user?.id ?? null,
      actorType: "USER",
      action: "github.connected",
      entityType: "integration",
      entityId: "github",
      metadata: { installationId, accountLogin, accountType, setupAction },
    });

    return NextResponse.redirect(successUrl(orgId));
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Installation sync failed";
    const healthSvc = new IntegrationHealthService(admin);
    await healthSvc.markError(orgId, "github", msg);
    await admin
      .from("integration_connections")
      .update({ status: "error" })
      .eq("org_id", orgId)
      .eq("provider", "github");

    return NextResponse.redirect(errorUrl(msg));
  }
}
