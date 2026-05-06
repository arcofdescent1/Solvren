import type { SupabaseClient } from "@supabase/supabase-js";

type LookupResult = {
  ok: boolean;
  user?: { id?: string };
  error?: string;
};

/**
 * When slack_user_map is missing, resolve Slack member via users.lookupByEmail and upsert the map.
 */
export async function resolveSlackDmUserIdWithLookupFallback(
  admin: SupabaseClient,
  args: { orgId: string; userId: string; slackTeamId: string; botToken: string }
): Promise<string | null> {
  const { orgId, userId, slackTeamId, botToken } = args;

  const { data: mapped } = await admin
    .from("slack_user_map")
    .select("slack_user_id")
    .eq("org_id", orgId)
    .eq("user_id", userId)
    .maybeSingle();

  const existing = (mapped as { slack_user_id?: string } | null)?.slack_user_id;
  if (existing) return existing;

  const { data: authUser, error: authErr } = await admin.auth.admin.getUserById(userId);
  if (authErr || !authUser?.user?.email) return null;
  const email = String(authUser.user.email).trim().toLowerCase();
  if (!email) return null;

  const res = await fetch("https://slack.com/api/users.lookupByEmail", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${botToken}`,
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify({ email }),
  });
  const json = (await res.json()) as LookupResult;
  if (!json.ok || !json.user?.id) return null;

  const slackUserId = String(json.user.id);
  const { error: upErr } = await admin.from("slack_user_map").upsert(
    {
      org_id: orgId,
      user_id: userId,
      slack_team_id: slackTeamId,
      slack_user_id: slackUserId,
    },
    { onConflict: "org_id,user_id" }
  );
  if (upErr) return null;

  return slackUserId;
}
