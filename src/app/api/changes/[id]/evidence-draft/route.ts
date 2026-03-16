import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { generateEvidenceDraft } from "@/services/ai/evidenceDraft";
import type { EvidenceKind } from "@/services/risk/requirements";

type Body = { kind: EvidenceKind };

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id: changeId } = await ctx.params;
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

  const kind = body?.kind;
  if (!kind)
    return NextResponse.json({ error: "Missing kind" }, { status: 400 });

  const { data: change, error: chErr } = await supabase
    .from("change_events")
    .select("id, org_id")
    .eq("id", changeId)
    .maybeSingle();

  if (chErr) return NextResponse.json({ error: chErr.message }, { status: 500 });
  if (!change) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const orgId = (change as { org_id: string }).org_id;

  const { data: member } = await supabase
    .from("organization_members")
    .select("id")
    .eq("org_id", orgId)
    .eq("user_id", userRes.user.id)
    .maybeSingle();

  if (!member)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const draft = await generateEvidenceDraft(supabase, { changeId, kind });
    return NextResponse.json(draft);
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to generate draft" },
      { status: 500 }
    );
  }
}
