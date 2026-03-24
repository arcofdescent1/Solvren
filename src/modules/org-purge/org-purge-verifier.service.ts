import type { SupabaseClient } from "@supabase/supabase-js";
import { ORG_PURGE_TABLE_SPECS } from "./org-purge-tables.generated";

export type VerifyRow = { table: string; orgColumn: string; count: number | null; ok: boolean; error?: string };

export type OrgPurgeVerificationResult = {
  targetOrgId: string;
  organizationRemoved: boolean;
  auditLogEmpty: boolean;
  integrationAccountsEmpty: boolean;
  processingJobsEmpty: boolean;
  tableChecks: VerifyRow[];
  allOk: boolean;
};

/**
 * Post-purge verification: expect no org-scoped application rows (purge audit tables exempt).
 */
export async function verifyOrgPurge(admin: SupabaseClient, orgId: string): Promise<OrgPurgeVerificationResult> {
  const tableChecks: VerifyRow[] = [];

  const { count: orgCount, error: orgErr } = await admin
    .from("organizations")
    .select("*", { count: "exact", head: true })
    .eq("id", orgId);

  const { count: auditCount, error: auditErr } = await admin
    .from("audit_log")
    .select("*", { count: "exact", head: true })
    .eq("org_id", orgId);

  const { count: intCount, error: intErr } = await admin
    .from("integration_accounts")
    .select("*", { count: "exact", head: true })
    .eq("org_id", orgId);

  const { count: pjCount, error: pjErr } = await admin
    .from("processing_jobs")
    .select("*", { count: "exact", head: true })
    .eq("org_id", orgId);

  for (const spec of ORG_PURGE_TABLE_SPECS) {
    const q = admin.from(spec.table).select("*", { count: "exact", head: true }).eq(spec.orgColumn, orgId);
    const { count, error } = await q;
    const c = error ? null : count ?? 0;
    tableChecks.push({
      table: spec.table,
      orgColumn: spec.orgColumn,
      count: c,
      ok: !error && c === 0,
      error: error?.message,
    });
  }

  const organizationRemoved = !orgErr && (orgCount ?? 0) === 0;
  const auditLogEmpty = !auditErr && (auditCount ?? 0) === 0;
  const integrationAccountsEmpty = !intErr && (intCount ?? 0) === 0;
  const processingJobsEmpty = !pjErr && (pjCount ?? 0) === 0;

  const tableOk = tableChecks.every((r) => r.ok);
  const allOk =
    organizationRemoved && auditLogEmpty && integrationAccountsEmpty && processingJobsEmpty && tableOk;

  return {
    targetOrgId: orgId,
    organizationRemoved,
    auditLogEmpty,
    integrationAccountsEmpty,
    processingJobsEmpty,
    tableChecks,
    allOk,
  };
}
