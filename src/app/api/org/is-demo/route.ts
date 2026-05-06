import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

/**
 * Client-readable demo flag: organizations.is_demo OR org_demo_config.is_demo_org.
 */
export async function GET() {
  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  const uid = userRes.user?.id;
  if (!uid) {
    return NextResponse.json({ isDemo: false }, { status: 401 });
  }

  const { data: m } = await supabase
    .from("organization_members")
    .select("org_id")
    .eq("user_id", uid)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  const orgId = m?.org_id as string | undefined;
  if (!orgId) {
    return NextResponse.json({ isDemo: false });
  }

  const [{ data: org }, { data: demoCfg }] = await Promise.all([
    supabase.from("organizations").select("is_demo").eq("id", orgId).maybeSingle(),
    supabase.from("org_demo_config").select("is_demo_org").eq("org_id", orgId).maybeSingle(),
  ]);

  const isDemo = Boolean(
    (org as { is_demo?: boolean } | null)?.is_demo ||
      (demoCfg as { is_demo_org?: boolean } | null)?.is_demo_org
  );

  return NextResponse.json({ isDemo, orgId });
}
