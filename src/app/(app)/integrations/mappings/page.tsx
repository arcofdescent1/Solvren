/**
 * Phase 1 — Integration mappings page (§9).
 * Mapping list + editor.
 */
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getActiveOrg } from "@/lib/org/activeOrg";
import { PageHeader } from "@/ui";
import MappingsClient from "./MappingsClient";

export default async function MappingsPage() {
  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) redirect("/login");

  const { activeOrgId, memberships } = await getActiveOrg(supabase, userRes.user.id);
  const membership = memberships.find((m) => m.orgId === activeOrgId);

  if (!activeOrgId || !membership) {
    return (
      <div className="space-y-4">
        <PageHeader breadcrumbs={[{ label: "Integrations", href: "/org/settings/integrations" }, { label: "Mappings" }]} title="Mappings" />
        <p className="text-sm text-[var(--text-muted)]">No organization selected.</p>
        <Link href="/dashboard" className="text-sm font-semibold text-[var(--primary)]">← Dashboard</Link>
      </div>
    );
  }

  const { data: mappingsRaw } = await supabase
    .from("integration_mappings")
    .select(`
      id, provider_key, source_object_type, canonical_object_type, version, status, is_active,
      integration_mapping_fields(source_path, canonical_field, transform_chain, default_value)
    `)
    .eq("org_id", activeOrgId)
    .order("provider_key")
    .order("source_object_type");

  const mappings = (mappingsRaw ?? []).map((m) => {
    const row = m as {
      id: string;
      provider_key: string;
      source_object_type: string;
      canonical_object_type: string;
      version: number;
      status: string;
      is_active: boolean;
      integration_mapping_fields?: Array<{
        source_path: string;
        canonical_field: string;
        transform_chain?: unknown;
        default_value?: string | null;
      }>;
    };
    const fields = row.integration_mapping_fields ?? [];
    const { integration_mapping_fields: _, ...rest } = row;
    return { ...rest, fields };
  });

  const { data: templatesRaw } = await supabase
    .from("integration_mapping_templates")
    .select(`
      id, provider_key, source_object_type, canonical_object_type, name,
      integration_mapping_template_fields(source_path, canonical_field, transform_chain, default_value)
    `)
    .eq("is_active", true);

  const templates = (templatesRaw ?? []).map((t) => {
    const row = t as {
      id: string;
      provider_key: string;
      source_object_type: string;
      canonical_object_type: string;
      name: string;
      integration_mapping_template_fields?: Array<{
        source_path: string;
        canonical_field: string;
        transform_chain?: unknown;
        default_value?: string | null;
      }>;
    };
    const fields = row.integration_mapping_template_fields ?? [];
    const { integration_mapping_template_fields: _, ...rest } = row;
    return { ...rest, fields };
  });

  return (
    <div className="max-w-5xl">
      <PageHeader
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Integrations", href: "/org/settings/integrations" },
          { label: "Mappings" },
        ]}
        title="Integration Mappings"
        description="Map provider objects to canonical models. Required before ingestion."
        right={
          <Link href="/org/settings/integrations" className="text-sm font-semibold text-[var(--primary)] hover:underline">
            ← Integrations
          </Link>
        }
      />
      <MappingsClient
        orgId={activeOrgId}
        initialMappings={mappings}
        templates={templates}
        isAdmin={membership.role === "owner" || membership.role === "admin"}
      />
    </div>
  );
}
