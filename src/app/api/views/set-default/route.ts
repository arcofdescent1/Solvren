import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type Body = { id: string };

export async function POST(req: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.id)
    return NextResponse.json({ error: "Missing id" }, { status: 400 });

  try {
    const { error: clearErr } = await supabase
      .from("user_saved_views")
      .update({ is_default: false })
      .eq("user_id", userRes.user.id)
      .eq("is_default", true);
    if (clearErr) throw new Error(clearErr.message);

    const { data, error: setErr } = await supabase
      .from("user_saved_views")
      .update({ is_default: true })
      .eq("id", body.id)
      .eq("user_id", userRes.user.id)
      .select("id, name, query, is_default")
      .single();
    if (setErr) throw new Error(setErr.message);

    return NextResponse.json({ ok: true, view: data });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Set default failed" },
      { status: 500 }
    );
  }
}
