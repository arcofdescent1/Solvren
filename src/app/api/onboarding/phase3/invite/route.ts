import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { auditLog } from "@/lib/audit";
import { generateInviteToken } from "@/lib/inviteToken";
import { sendInviteEmail } from "@/services/invites/sendInviteEmail";
import { env } from "@/lib/env";
import { isAdminLikeRole, parseOrgRole } from "@/lib/rbac/roles";
import { trackServerAppEvent } from "@/lib/analytics/serverAppAnalytics";
import { phase3AnalyticsBase } from "@/modules/onboarding/phase3/phase3-analytics-payload";
import { getOrgOnboardingState } from "@/modules/onboarding/repositories/org-onboarding-states.repository";
import { DEPARTMENTS } from "@/modules/onboarding/phase3/phase3-constants";
import { requirePhase3OrgContext } from "../_phase3Context";

export const runtime = "nodejs";

const INVITE_EXPIRY_DAYS = 7;
const ALLOWED_ROLES = ["owner", "admin", "reviewer", "submitter", "viewer"] as const;

function mapRole(role: string): (typeof ALLOWED_ROLES)[number] {
  const r = role.trim().toLowerCase();
  if (ALLOWED_ROLES.includes(r as (typeof ALLOWED_ROLES)[number])) return r as (typeof ALLOWED_ROLES)[number];
  return "viewer";
}

async function requireAdminForOrg(
  supabase: Awaited<ReturnType<typeof import("@/lib/supabase/server").createServerSupabaseClient>>,
  userId: string,
  orgId: string
): Promise<{ ok: true } | { ok: false; response: NextResponse }> {
  const { data: member } = await supabase
    .from("organization_members")
    .select("role")
    .eq("org_id", orgId)
    .eq("user_id", userId)
    .maybeSingle();
  const role = (member as { role?: string } | null)?.role ?? null;
  if (!isAdminLikeRole(parseOrgRole(role))) {
    return { ok: false, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { ok: true };
}

function normalizeDepartment(raw: string | undefined): string | null {
  if (!raw || typeof raw !== "string") return null;
  const d = raw.trim();
  if (!d) return null;
  const found = DEPARTMENTS.find((x) => x === d);
  return found ?? null;
}

export async function POST(req: NextRequest) {
  const gate = await requirePhase3OrgContext();
  if (!gate.ok) return gate.response;
  const { supabase, userId, userEmail, orgId } = gate.ctx;

  const adminCheck = await requireAdminForOrg(supabase, userId, orgId);
  if (!adminCheck.ok) return adminCheck.response;

  let body: { email?: string; name?: string; role?: string; department?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!email) return NextResponse.json({ error: "Email is required" }, { status: 400 });
  const role = mapRole(typeof body.role === "string" ? body.role : "viewer");
  const department = normalizeDepartment(body.department);
  if (body.department && !department) {
    return NextResponse.json({ error: "invalid_department" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: org } = await admin.from("organizations").select("name").eq("id", orgId).single();
  const orgName = (org as { name?: string } | null)?.name ?? "the organization";

  const { data: pendingInvite } = await admin
    .from("org_invites")
    .select("id")
    .eq("org_id", orgId)
    .ilike("email", email)
    .eq("status", "PENDING")
    .maybeSingle();

  if (pendingInvite) {
    await admin
      .from("org_invites")
      .update({ status: "REVOKED", updated_at: new Date().toISOString() })
      .eq("id", (pendingInvite as { id: string }).id);
  }

  const { token, tokenHash } = generateInviteToken();
  const expiresAt = new Date(Date.now() + INVITE_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

  const insertPayload: Record<string, unknown> = {
    org_id: orgId,
    email,
    role,
    token_hash: tokenHash,
    status: "PENDING",
    invited_by_user_id: userId,
    expires_at: expiresAt.toISOString(),
  };
  if (department) insertPayload.department = department;

  const { data: invite, error: insertErr } = await admin.from("org_invites").insert(insertPayload).select("id").single();

  if (insertErr) {
    return NextResponse.json({ error: insertErr.message }, { status: 500 });
  }

  const acceptLink = `${env.appUrl.replace(/\/$/, "")}/invite/accept?token=${encodeURIComponent(token)}`;
  const sendResult = await sendInviteEmail({
    to: email,
    orgName,
    inviterName: userEmail ?? null,
    role,
    acceptLink,
    expiresInDays: INVITE_EXPIRY_DAYS,
  });

  if (!sendResult.sent) {
    console.warn("[phase3/invite] invite email failed:", sendResult.error);
  }

  await auditLog(admin, {
    orgId,
    actorId: userId,
    actorType: "USER",
    action: "invite_created",
    entityType: "org_invite",
    entityId: invite.id,
    metadata: {
      email,
      role,
      inviteId: invite.id,
      source: "phase3",
      department: department ?? undefined,
    },
  });

  const { data: onboardRow } = await getOrgOnboardingState(admin, orgId);
  await trackServerAppEvent(admin, {
    orgId,
    userId,
    event: "onboarding_phase3_team_invited",
    properties: {
      ...phase3AnalyticsBase(orgId, onboardRow?.phase3_status, onboardRow?.phase3_current_step),
      department: department ?? "",
    },
  });

  return NextResponse.json({
    ok: true,
    inviteId: invite.id,
    email,
    role,
    department,
    expiresAt: expiresAt.toISOString(),
    emailSent: sendResult.sent,
  });
}
