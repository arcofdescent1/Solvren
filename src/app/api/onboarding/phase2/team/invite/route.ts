import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { auditLog } from "@/lib/audit";
import { generateInviteToken } from "@/lib/inviteToken";
import { sendInviteEmail } from "@/services/invites/sendInviteEmail";
import { env } from "@/lib/env";
import { isAdminLikeRole, parseOrgRole } from "@/lib/rbac/roles";
import { trackServerAppEvent } from "@/lib/analytics/serverAppAnalytics";
import { phase2AnalyticsBase } from "@/modules/onboarding/phase2/phase2-analytics-payload";
import { getOrgOnboardingState } from "@/modules/onboarding/repositories/org-onboarding-states.repository";
import { requirePhase2OrgContext } from "../../_phase2Context";

export const runtime = "nodejs";

const INVITE_EXPIRY_DAYS = 7;
const ALLOWED_ROLES = ["owner", "admin", "reviewer", "submitter", "viewer"] as const;

function mapOnboardingRoleToInviteRole(role: string): (typeof ALLOWED_ROLES)[number] {
  const r = role.trim().toLowerCase();
  if (ALLOWED_ROLES.includes(r as (typeof ALLOWED_ROLES)[number])) return r as (typeof ALLOWED_ROLES)[number];
  const map: Record<string, (typeof ALLOWED_ROLES)[number]> = {
    executive_sponsor: "viewer",
    executive_viewer: "viewer",
    operations_lead: "admin",
    revops_lead: "admin",
    risk_admin: "admin",
    it_systems_owner: "admin",
    department_manager: "reviewer",
    approver: "reviewer",
    analyst: "submitter",
  };
  return map[r] ?? "viewer";
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

export async function POST(req: NextRequest) {
  const gate = await requirePhase2OrgContext();
  if (!gate.ok) return gate.response;
  const { supabase, userId, userEmail, orgId } = gate.ctx;

  const adminCheck = await requireAdminForOrg(supabase, userId, orgId);
  if (!adminCheck.ok) return adminCheck.response;

  let body: { email?: string; name?: string; team?: string; role?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!email) return NextResponse.json({ error: "Email is required" }, { status: 400 });
  const role = mapOnboardingRoleToInviteRole(typeof body.role === "string" ? body.role : "viewer");
  const onboardingName = typeof body.name === "string" ? body.name.trim() : "";
  const onboardingTeam = typeof body.team === "string" ? body.team.trim() : "";

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

  const { data: invite, error: insertErr } = await admin
    .from("org_invites")
    .insert({
      org_id: orgId,
      email,
      role,
      token_hash: tokenHash,
      status: "PENDING",
      invited_by_user_id: userId,
      expires_at: expiresAt.toISOString(),
    })
    .select("id")
    .single();

  if (insertErr) {
    return NextResponse.json({ error: insertErr.message }, { status: 500 });
  }

  const acceptLink = `${env.appUrl.replace(/\/$/, "")}/invite/accept?token=${encodeURIComponent(token)}`;
  const inviterName = userEmail ?? null;
  const sendResult = await sendInviteEmail({
    to: email,
    orgName,
    inviterName,
    role,
    acceptLink,
    expiresInDays: INVITE_EXPIRY_DAYS,
  });

  if (!sendResult.sent) {
    console.warn("[phase2/team/invite] invite email failed:", sendResult.error);
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
      phase2Activation: true,
      onboardingDisplayName: onboardingName || undefined,
      onboardingTeam: onboardingTeam || undefined,
    },
  });

  const { data: onboardRow } = await getOrgOnboardingState(admin, orgId);
  const emailDomain = email.includes("@") ? email.slice(email.indexOf("@") + 1) : "unknown";
  await trackServerAppEvent(admin, {
    orgId,
    userId,
    event: "onboarding_phase2_team_invite_sent",
    properties: {
      ...phase2AnalyticsBase(orgId, onboardRow?.phase2_status, onboardRow?.phase2_current_step),
      inviteRole: role,
      inviteEmailDomain: emailDomain,
    },
  });

  return NextResponse.json({
    ok: true,
    inviteId: invite.id,
    email,
    role,
    expiresAt: expiresAt.toISOString(),
    emailSent: sendResult.sent,
  });
}
