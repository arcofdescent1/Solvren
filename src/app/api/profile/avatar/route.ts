import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createPrivilegedClient } from "@/lib/server/adminClient";

export const runtime = "nodejs";

const AVATAR_BUCKET = "profile-avatars";
const MAX_BYTES = 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/webp", "image/png", "image/jpeg"]);

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  const user = userRes.user;
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const form = await req.formData();
  const file = form.get("file");
  const displayNameRaw = form.get("displayName");
  const displayName = typeof displayNameRaw === "string" ? displayNameRaw.trim().slice(0, 120) : null;

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Upload a profile image." }, { status: 400 });
  }
  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json({ error: "Use a WebP, PNG, or JPEG image." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Profile images must be 1MB or smaller after resizing." }, { status: 400 });
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const contentType = file.type || "image/webp";
  const extension = contentType === "image/png" ? "png" : contentType === "image/jpeg" ? "jpg" : "webp";
  const avatarPath = `${user.id}/avatar.${extension}`;
  const admin = createPrivilegedClient("POST /api/profile/avatar: upload current user's avatar and profile metadata");

  const { error: uploadError } = await admin.storage
    .from(AVATAR_BUCKET)
    .upload(avatarPath, bytes, {
      contentType,
      cacheControl: "3600",
      upsert: true,
    });

  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 });

  const { data: publicUrl } = admin.storage.from(AVATAR_BUCKET).getPublicUrl(avatarPath);
  const avatarUrl = publicUrl.publicUrl ? `${publicUrl.publicUrl}?v=${Date.now()}` : null;

  const { error: profileError } = await admin
    .from("user_profiles")
    .upsert(
      {
        user_id: user.id,
        display_name: displayName || null,
        avatar_url: avatarUrl,
        avatar_path: avatarPath,
        avatar_updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );

  if (profileError) return NextResponse.json({ error: profileError.message }, { status: 500 });

  return NextResponse.json({ ok: true, profile: { displayName, avatarUrl } });
}
