/**
 * GET /api/integrations/github/config?orgId=
 * PUT /api/integrations/github/config
 */
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { authzErrorResponse, parseRequestedOrgId, requireOrgPermission } from "@/lib/server/authz";
import { auditLog } from "@/lib/audit";
import { env } from "@/lib/env";

export async function GET(req: NextRequest) {
  try {
    if (!env.githubEnabled) {
      return NextResponse.json({ connected: false });
    }

    const orgId = req.nextUrl.searchParams.get("orgId");
    if (!orgId) return NextResponse.json({ error: "orgId required" }, { status: 400 });
    const ctx = await requireOrgPermission(parseRequestedOrgId(orgId), "integrations.view");
    const admin = createAdminClient();

    const { data: inst } = await admin
      .from("github_installations")
      .select("github_installation_id, github_account_login, github_account_type")
      .eq("org_id", ctx.orgId)
      .maybeSingle();

    const { data: repos } = await admin
      .from("github_repositories")
      .select("github_repository_id, full_name")
      .eq("org_id", ctx.orgId)
      .eq("active", true);

    const { data: configs } = await admin
      .from("github_repo_configs")
      .select("*")
      .eq("org_id", ctx.orgId);

    const configMap = new Map(
      (configs ?? []).map((c) => [(c as { github_repository_id: number }).github_repository_id, c])
    );

    const repositories = (repos ?? []).map((r) => {
      const rid = (r as { github_repository_id: number }).github_repository_id;
      const cfg = configMap.get(rid) as {
        enabled?: boolean;
        auto_create_change_from_pr?: boolean;
        auto_detect_push_changes?: boolean;
        status_checks_enabled?: boolean;
        pr_comment_sync_enabled?: boolean;
        default_domain?: string | null;
        file_path_rules?: unknown;
        branch_rules?: unknown;
      } | undefined;
      return {
        repositoryId: rid,
        fullName: (r as { full_name: string }).full_name,
        enabled: cfg?.enabled ?? true,
        autoCreateChangeFromPr: cfg?.auto_create_change_from_pr ?? true,
        autoDetectPushChanges: cfg?.auto_detect_push_changes ?? true,
        statusChecksEnabled: cfg?.status_checks_enabled ?? true,
        prCommentSyncEnabled: cfg?.pr_comment_sync_enabled ?? false,
        defaultDomain: cfg?.default_domain ?? null,
        filePathRules: cfg?.file_path_rules ?? [],
        branchRules: cfg?.branch_rules ?? {},
      };
    });

    const { data: lastEvt } = await admin
      .from("github_webhook_events")
      .select("received_at")
      .eq("org_id", ctx.orgId)
      .order("received_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data: failed } = await admin
      .from("github_webhook_events")
      .select("id")
      .eq("org_id", ctx.orgId)
      .eq("processed", false)
      .not("error_message", "is", null)
      .limit(10);

    return NextResponse.json({
      connected: !!inst,
      installation: inst
        ? {
            installationId: (inst as { github_installation_id: number }).github_installation_id,
            accountLogin: (inst as { github_account_login: string }).github_account_login,
            accountType: (inst as { github_account_type: string }).github_account_type,
          }
        : null,
      repositories,
      health: {
        status: (failed?.length ?? 0) > 0 ? "degraded" : "healthy",
        lastWebhookAt: (lastEvt as { received_at?: string })?.received_at ?? null,
        failedEventCount: failed?.length ?? 0,
      },
    });
  } catch (e) {
    return authzErrorResponse(e);
  }
}

export async function PUT(req: NextRequest) {
  try {
    if (!env.githubEnabled) return NextResponse.json({ error: "GitHub not configured" }, { status: 503 });

    let body: {
      organizationId?: string;
      repositories?: Array<{
        repositoryId: number;
        enabled?: boolean;
        autoCreateChangeFromPr?: boolean;
        autoDetectPushChanges?: boolean;
        statusChecksEnabled?: boolean;
        prCommentSyncEnabled?: boolean;
        defaultDomain?: string | null;
        filePathRules?: Array<{ pattern: string; domain: string; riskWeight: number }>;
        branchRules?: Record<string, unknown>;
      }>;
    };
    try {
      body = (await req.json()) as typeof body;
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const orgId = body.organizationId ?? req.nextUrl.searchParams.get("orgId");
    if (!orgId) return NextResponse.json({ error: "organizationId required" }, { status: 400 });
    const ctx = await requireOrgPermission(parseRequestedOrgId(orgId), "integrations.manage");
    const admin = createAdminClient();

    const { data: inst } = await admin.from("github_installations").select("id").eq("org_id", ctx.orgId).maybeSingle();
    if (!inst) return NextResponse.json({ error: "GitHub not connected" }, { status: 400 });

    const repos = body.repositories ?? [];
    for (const r of repos) {
      await admin.from("github_repo_configs").upsert(
        {
          org_id: ctx.orgId,
          github_repository_id: r.repositoryId,
          enabled: r.enabled ?? true,
          auto_create_change_from_pr: r.autoCreateChangeFromPr ?? true,
          auto_detect_push_changes: r.autoDetectPushChanges ?? true,
          status_checks_enabled: r.statusChecksEnabled ?? true,
          pr_comment_sync_enabled: r.prCommentSyncEnabled ?? false,
          default_domain: r.defaultDomain ?? null,
          file_path_rules: r.filePathRules ?? [],
          branch_rules: r.branchRules ?? {},
        },
        { onConflict: "org_id,github_repository_id" }
      );
    }

    await auditLog(ctx.supabase, {
      orgId: ctx.orgId,
      actorId: ctx.user.id,
      actorType: "USER",
      action: "github.repo_config.updated",
      entityType: "integration",
      entityId: "github",
      metadata: { repositoryCount: repos.length },
    });

    return NextResponse.json({ success: true });
  } catch (e) {
    return authzErrorResponse(e);
  }
}
