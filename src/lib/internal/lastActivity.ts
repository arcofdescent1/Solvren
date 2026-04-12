import type { SupabaseClient } from "@supabase/supabase-js";

function maxIso(...dates: (string | null | undefined)[]): string | null {
  const parsed = dates
    .filter((d): d is string => typeof d === "string" && d.length > 0)
    .map((d) => new Date(d).getTime())
    .filter((t) => !Number.isNaN(t));
  if (parsed.length === 0) return null;
  return new Date(Math.max(...parsed)).toISOString();
}

/**
 * Phase 1 fallback: greatest(customer audit, internal audit, latest invite, latest member, org created).
 */
export async function computeLastActivityAt(
  admin: SupabaseClient,
  orgId: string,
  orgCreatedAt: string
): Promise<string> {
  const [{ data: cust }, { data: internal }, { data: inv }, { data: mem }] = await Promise.all([
    admin.from("audit_log").select("created_at").eq("org_id", orgId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    admin
      .from("internal_admin_audit_log")
      .select("created_at")
      .eq("org_id", orgId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    admin.from("org_invites").select("created_at").eq("org_id", orgId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    admin
      .from("organization_members")
      .select("created_at")
      .eq("org_id", orgId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const m = maxIso(
    (cust as { created_at?: string } | null)?.created_at,
    (internal as { created_at?: string } | null)?.created_at,
    (inv as { created_at?: string } | null)?.created_at,
    (mem as { created_at?: string } | null)?.created_at,
    orgCreatedAt
  );
  return m ?? orgCreatedAt;
}
