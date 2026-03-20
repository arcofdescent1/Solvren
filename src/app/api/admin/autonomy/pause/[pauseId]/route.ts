/**
 * Phase 9 — DELETE /api/admin/autonomy/pause/:pauseId (§17.4).
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { clearPauseControl } from "@/modules/autonomy-safety/repositories/autonomy-pause-controls.repository";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ pauseId: string }> }
) {
  const { pauseId } = await params;
  if (!pauseId) {
    return NextResponse.json({ error: "pauseId required" }, { status: 400 });
  }

  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { error } = await clearPauseControl(supabase, pauseId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
