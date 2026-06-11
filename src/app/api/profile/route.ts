import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createPrivilegedClient } from "@/lib/server/adminClient";

export const runtime = "nodejs";

export async function PATCH(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  const user = userRes.user;
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { displayName?: unknown };
  const displayName = typeof body.displayName === "string" ? body.displayName.trim().slice(0, 120) : "";
  if (!displayName) return NextResponse.json({ error: "Enter a display name." }, { status: 400 });

  const admin = createPrivilegedClient("PATCH /api/profile: update current user's profile metadata");
  const { data: existing } = await admin
    .from("user_profiles")
    .select("avatar_url, avatar_path, avatar_updated_at")
    .eq("user_id", user.id)
    .maybeSingle();

  const { error } = await admin
    .from("user_profiles")
    .upsert(
      {
        user_id: user.id,
        display_name: displayName,
        avatar_url: (existing as { avatar_url?: string | null } | null)?.avatar_url ?? null,
        avatar_path: (existing as { avatar_path?: string | null } | null)?.avatar_path ?? null,
        avatar_updated_at: (existing as { avatar_updated_at?: string | null } | null)?.avatar_updated_at ?? null,
      },
      { onConflict: "user_id" }
    );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, profile: { displayName } });
}
