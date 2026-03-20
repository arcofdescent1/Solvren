/**
 * Phase 0 — Issue APIs: list and create.
 */
import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  createIssueFromSource,
  listIssues,
  type CreateIssueInput,
  type IssueSourceType,
  type IssueStatus,
  type VerificationStatus,
} from "@/modules/issues";

async function getOrgId(supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>) {
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) return { orgId: null as string | null, userId: null as string | null };
  const { data: membership } = await supabase
    .from("organization_members")
    .select("org_id")
    .eq("user_id", userRes.user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  return {
    orgId: membership?.org_id ?? null,
    userId: userRes.user.id,
  };
}

export async function GET(req: Request) {
  const supabase = await createServerSupabaseClient();
  const { orgId } = await getOrgId(supabase);
  if (!orgId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const source_type = searchParams.get("source_type");
  const severity = searchParams.get("severity");
  const domain_key = searchParams.get("domain_key");
  const verification_status = searchParams.get("verification_status");
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "50", 10) || 50, 100);
  const offset = parseInt(searchParams.get("offset") ?? "0", 10) || 0;

  const result = await listIssues(supabase, {
    org_id: orgId,
    ...(status && { status: status as IssueStatus }),
    ...(source_type && { source_type: source_type as IssueSourceType }),
    ...(severity && { severity: severity as "low" | "medium" | "high" | "critical" }),
    ...(domain_key && { domain_key }),
    ...(verification_status && { verification_status: verification_status as VerificationStatus }),
    limit,
    offset,
  });

  if (result.error)
    return NextResponse.json({ error: result.error }, { status: 500 });

  return NextResponse.json({
    issues: result.issues,
    timestamps: { openedAt: null, updatedAt: null },
  });
}

export async function POST(req: Request) {
  const supabase = await createServerSupabaseClient();
  const { orgId, userId } = await getOrgId(supabase);
  if (!orgId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const b = body as Record<string, unknown>;
  const source_type = b.source_type as string;
  const source_ref = b.source_ref as string;
  const domain_key = (b.domain_key as string) ?? "revenue";
  const title = (b.title as string) ?? "Untitled issue";

  const validSourceTypes: IssueSourceType[] = [
    "change",
    "detector",
    "integration_event",
    "incident",
    "manual",
    "system_health",
    "verification_failure",
  ];
  if (!source_type || !validSourceTypes.includes(source_type as IssueSourceType))
    return NextResponse.json(
      { error: "Missing or invalid source_type" },
      { status: 400 }
    );
  if (!source_ref || typeof source_ref !== "string")
    return NextResponse.json(
      { error: "Missing or invalid source_ref" },
      { status: 400 }
    );

  const input: CreateIssueInput = {
    org_id: orgId,
    source_type: source_type as IssueSourceType,
    source_ref,
    domain_key,
    title,
    description: (b.description as string) ?? null,
    summary: (b.summary as string) ?? null,
    severity: (b.severity as CreateIssueInput["severity"]) ?? "medium",
    created_by: userId ?? null,
  };

  const result = await createIssueFromSource(supabase, input);
  if (result.error)
    return NextResponse.json({ error: result.error }, { status: 500 });
  if (!result.issue)
    return NextResponse.json({ error: "Create failed" }, { status: 500 });

  const i = result.issue;
  return NextResponse.json({
    id: i.id,
    issueKey: i.issue_key,
    sourceType: i.source_type,
    sourceRef: i.source_ref,
    domainKey: i.domain_key,
    title: i.title,
    status: i.status,
    verificationStatus: i.verification_status,
    severity: i.severity,
    timestamps: {
      openedAt: i.opened_at,
      updatedAt: i.updated_at,
      resolvedAt: i.resolved_at,
      verifiedAt: i.verified_at,
    },
  });
}
