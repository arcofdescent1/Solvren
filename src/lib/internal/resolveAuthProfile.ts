import type { User } from "@supabase/supabase-js";

export function fullNameFromAuthUser(user: User | null | undefined): string | null {
  if (!user) return null;
  const meta = user.user_metadata as Record<string, unknown> | undefined;
  const fromMeta =
    (typeof meta?.full_name === "string" && meta.full_name) ||
    (typeof meta?.name === "string" && meta.name) ||
    (typeof meta?.display_name === "string" && meta.display_name) ||
    null;
  return fromMeta && String(fromMeta).trim() ? String(fromMeta).trim() : null;
}
