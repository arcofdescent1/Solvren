import { createServerSupabaseClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getActiveOrg } from "@/lib/org/activeOrg";
import { PageHeader, Stack } from "@/ui";
import { isAdminLikeRole, parseOrgRole } from "@/lib/rbac/roles";

export default async function SupportAccessSettingsPage() {
  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) redirect("/login");

  const { activeOrgId, memberships } = await getActiveOrg(supabase, userRes.user.id);
  const membership = memberships.find((m) => m.orgId === activeOrgId);

  if (!activeOrgId || !membership) {
    return (
      <Stack gap={4}>
        <p className="text-sm text-[var(--text)]">No organization selected.</p>
        <Link href="/dashboard" className="text-sm font-semibold text-[var(--primary)] hover:underline">
          Back to dashboard
        </Link>
      </Stack>
    );
  }

  if (!isAdminLikeRole(parseOrgRole(membership.role ?? null))) {
    return (
      <Stack gap={4}>
        <p className="text-sm text-[var(--text)]">Only organization owners and admins can manage support access.</p>
        <Link href="/settings" className="text-sm font-semibold text-[var(--primary)] hover:underline">
          Back to settings
        </Link>
      </Stack>
    );
  }

  const [{ data: grants }, { data: breakGlass }, { data: audit }] = await Promise.all([
    supabase
      .from("customer_access_grants")
      .select("id, access_level, status, reason, created_at, expires_at, approved_at, employee_user_id")
      .eq("org_id", activeOrgId)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("break_glass_access_events")
      .select("id, severity, reason, activated_at, expires_at, ended_at, created_at")
      .eq("org_id", activeOrgId)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("employee_access_audit")
      .select("id, access_type, access_level, legal_basis, resource_type, reason, created_at")
      .eq("org_id", activeOrgId)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  return (
    <div className="max-w-3xl">
      <Stack gap={6}>
        <PageHeader
          breadcrumbs={[
            { label: "Dashboard", href: "/dashboard" },
            { label: "Settings", href: "/settings" },
            { label: "Security", href: "/settings/security" },
            { label: "Support access" },
          ]}
          title="Support access"
          description="Solvren employees do not have default access to your sensitive operational data. You control time-boxed support grants; all employee access is audited."
        />

        <section className="space-y-2 rounded-xl border border-[var(--border)] p-4">
          <h2 className="text-sm font-semibold">Pending &amp; recent grants</h2>
          <ul className="list-inside list-disc text-sm text-[var(--text-muted)]">
            {(grants ?? []).length === 0 ? (
              <li>No grant requests yet.</li>
            ) : (
              (grants ?? []).map((g) => (
                <li key={(g as { id: string }).id}>
                  {(g as { status: string }).status} — {(g as { access_level: string }).access_level} —{" "}
                  {String((g as { created_at: string }).created_at).slice(0, 10)}
                </li>
              ))
            )}
          </ul>
        </section>

        <section className="space-y-2 rounded-xl border border-[var(--border)] p-4">
          <h2 className="text-sm font-semibold">Break-glass events</h2>
          <ul className="list-inside list-disc text-sm text-[var(--text-muted)]">
            {(breakGlass ?? []).length === 0 ? (
              <li>No events recorded.</li>
            ) : (
              (breakGlass ?? []).map((e) => (
                <li key={(e as { id: string }).id}>
                  {(e as { severity: string }).severity} — activated{" "}
                  {(e as { activated_at: string | null }).activated_at
                    ? String((e as { activated_at: string }).activated_at).slice(0, 16)
                    : "pending"}
                </li>
              ))
            )}
          </ul>
        </section>

        <section className="space-y-2 rounded-xl border border-[var(--border)] p-4">
          <h2 className="text-sm font-semibold">Employee access audit (recent)</h2>
          <ul className="list-inside list-disc text-sm text-[var(--text-muted)]">
            {(audit ?? []).length === 0 ? (
              <li>No audit entries yet.</li>
            ) : (
              (audit ?? []).map((a) => (
                <li key={(a as { id: string }).id}>
                  {(a as { access_type: string }).access_type} / {(a as { access_level: string }).access_level} —{" "}
                  {(a as { resource_type: string }).resource_type} —{" "}
                  {String((a as { created_at: string }).created_at).slice(0, 16)}
                </li>
              ))
            )}
          </ul>
        </section>
      </Stack>
    </div>
  );
}
