/**
 * Phase 8 — GET /api/admin/autonomy/playbooks.
 */
import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { listPlaybookDefinitions, getOrgPlaybookConfigs } from "@/modules/autonomy/persistence/playbooks.repository";

export async function GET() {
  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: membership } = await supabase
    .from("organization_members")
    .select("org_id")
    .eq("user_id", userRes.user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!membership?.org_id) return NextResponse.json({ error: "No org" }, { status: 403 });

  const [{ data: definitions }, { data: configs }] = await Promise.all([
    listPlaybookDefinitions(supabase),
    getOrgPlaybookConfigs(supabase, membership.org_id),
  ]);

  const configMap = new Map((configs ?? []).map((c) => [c.playbook_definition_id, c]));

  const playbooks = (definitions ?? []).map((d) => ({
    ...d,
    config: configMap.get(d.id) ?? null,
  }));

  return NextResponse.json({ playbooks });
}
