import type { SupabaseClient } from "@supabase/supabase-js";

export const SLACK_NOT_LINKED_EPHEMERAL =
  "Your Slack account is not linked to Solvren. Contact your administrator.";

type ResolveArgs = {
  orgId: string;
  slackTeamId: string;
  slackUserId: string;
  botToken: string | null;
  admin: SupabaseClient;
};

/**
 * Phase 4: Resolve Slack user → Solvren user for an org.
 * 1) slack_user_map (org + slack_user_id, matching team when possible)
 * 2) Slack users.info email + get_auth_user_id_by_email + org membership
 */
export async function resolveSlackToSolvrenUserId(args: ResolveArgs): Promise<string | null> {
  const { orgId, slackTeamId: _slackTeamId, slackUserId, botToken, admin } = args;

  const { data: mapped } = await admin
    .from("slack_user_map")
    .select("user_id, slack_team_id")
    .eq("org_id", orgId)
    .eq("slack_user_id", slackUserId)
    .maybeSingle();

  if (mapped?.user_id) {
    const { data: member } = await admin
      .from("organization_members")
      .select("user_id")
      .eq("org_id", orgId)
      .eq("user_id", mapped.user_id as string)
      .maybeSingle();
    if (member) return mapped.user_id as string;
  }

  if (!botToken) return null;

  const res = await fetch("https://slack.com/api/users.info", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${botToken}`,
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify({ user: slackUserId }),
  });
  const json = (await res.json()) as {
    ok?: boolean;
    user?: { profile?: { email?: string } };
  };
  const email = json?.user?.profile?.email?.trim().toLowerCase();
  if (!email) return null;

  const { data: userIdRaw, error: rpcErr } = await admin.rpc("get_auth_user_id_by_email", {
    p_email: email,
  });
  if (rpcErr || !userIdRaw) return null;
  const userId = String(userIdRaw);

  const { data: member } = await admin
    .from("organization_members")
    .select("user_id")
    .eq("org_id", orgId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!member) return null;

  return userId;
}
