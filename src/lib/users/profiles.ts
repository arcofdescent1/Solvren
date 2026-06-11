import type { SupabaseClient } from "@supabase/supabase-js";

export type UserProfileSummary = {
  userId: string;
  displayName: string | null;
  avatarUrl: string | null;
};

type UserProfileRow = {
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
};

export async function getUserProfile(
  supabase: SupabaseClient,
  userId: string
): Promise<UserProfileSummary | null> {
  const { data } = await supabase
    .from("user_profiles")
    .select("user_id, display_name, avatar_url")
    .eq("user_id", userId)
    .maybeSingle();

  const row = data as UserProfileRow | null;
  if (!row) return null;
  return {
    userId: row.user_id,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
  };
}

export async function getUserProfileMap(
  supabase: SupabaseClient,
  userIds: Array<string | null | undefined>
): Promise<Map<string, UserProfileSummary>> {
  const ids = Array.from(new Set(userIds.filter((id): id is string => Boolean(id))));
  if (ids.length === 0) return new Map();

  const { data } = await supabase
    .from("user_profiles")
    .select("user_id, display_name, avatar_url")
    .in("user_id", ids);

  const map = new Map<string, UserProfileSummary>();
  for (const row of (data ?? []) as UserProfileRow[]) {
    map.set(row.user_id, {
      userId: row.user_id,
      displayName: row.display_name,
      avatarUrl: row.avatar_url,
    });
  }
  return map;
}
