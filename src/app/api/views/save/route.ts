import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type Body = {
  name: string;
  query: Record<string, unknown>;
  isDefault?: boolean;
};

export async function POST(req: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const name = (body.name ?? "").trim();
  if (!name) return NextResponse.json({ error: "Missing name" }, { status: 400 });
  if (!body.query || typeof body.query !== "object") {
    return NextResponse.json({ error: "Missing query" }, { status: 400 });
  }

  const isDefault = !!body.isDefault;

  try {
    if (isDefault) {
      const { error: clearErr } = await supabase
        .from("user_saved_views")
        .update({ is_default: false })
        .eq("user_id", userRes.user.id)
        .eq("is_default", true);
      if (clearErr) throw new Error(clearErr.message);
    }

    const { data, error } = await supabase
      .from("user_saved_views")
      .upsert(
        {
          user_id: userRes.user.id,
          name,
          query: body.query,
          is_default: isDefault,
        },
        { onConflict: "user_id,name" }
      )
      .select("id, name, query, is_default, created_at, updated_at")
      .single();

    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true, view: data });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Save failed" },
      { status: 500 }
    );
  }
}
