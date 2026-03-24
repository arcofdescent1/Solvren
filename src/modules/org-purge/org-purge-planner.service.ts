import type { SupabaseClient } from "@supabase/supabase-js";
import { ORG_PURGE_TABLE_SPECS } from "./org-purge-tables.generated";
import { evaluateOrgPurgeRetention } from "./org-purge-retention-evaluator.service";
import { getAccountsByOrg } from "@/modules/integrations/core/integrationAccountsRepo";
import type { PurgePlan, TableRowCount } from "./types";

const EXPLICIT_PRE_ORG_DELETES = ["audit_log"] as const;

async function countForTable(
  admin: SupabaseClient,
  orgId: string,
  table: string,
  orgColumn: "org_id" | "organization_id"
): Promise<TableRowCount> {
  try {
    const q = admin.from(table).select("*", { count: "exact", head: true }).eq(orgColumn, orgId);
    const { error, count } = await q;
    if (error) {
      return { table, orgColumn, count: null, error: error.message };
    }
    return { table, orgColumn, count: count ?? 0 };
  } catch (e) {
    return {
      table,
      orgColumn,
      count: null,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

/**
 * Dry-run capable plan: row estimates, integrations, queues, retention summary.
 */
export async function buildOrgPurgePlan(
  admin: SupabaseClient,
  input: { orgId: string; legalHoldActive: boolean }
): Promise<PurgePlan> {
  const evaluation = evaluateOrgPurgeRetention({ legalHoldActive: input.legalHoldActive });

  const tableCounts: TableRowCount[] = [];
  for (const spec of ORG_PURGE_TABLE_SPECS) {
    tableCounts.push(await countForTable(admin, input.orgId, spec.table, spec.orgColumn));
  }

  const { data: orgRow } = await admin.from("organizations").select("id").eq("id", input.orgId).maybeSingle();

  const { data: accounts } = await getAccountsByOrg(admin, input.orgId);

  const pj = await admin
    .from("processing_jobs")
    .select("*", { count: "exact", head: true })
    .eq("org_id", input.orgId)
    .in("status", ["pending", "running"]);

  const billing = await admin.from("billing_accounts").select("*").eq("org_id", input.orgId).maybeSingle();

  if (evaluation.blocked) {
    return {
      targetOrgId: input.orgId,
      blocked: true,
      blockReason: evaluation.message,
      retentionExceptions: [{ code: "RETAIN_LEGAL_HOLD", note: evaluation.message }],
      tableCounts,
      organizationRowExists: !!orgRow,
      integrationAccounts:
        accounts?.map((a) => ({
          id: a.id,
          provider: a.provider,
          displayName: a.display_name,
        })) ?? [],
      processingJobsPending: pj.error ? null : pj.count ?? 0,
      storagePrefixSample: [`${input.orgId}/`],
      explicitPreOrgDeletes: [...EXPLICIT_PRE_ORG_DELETES],
      financeSnapshotRequired: !!billing,
    };
  }

  return {
    targetOrgId: input.orgId,
    blocked: false,
    retentionExceptions: evaluation.exceptions,
    tableCounts,
    organizationRowExists: !!orgRow,
    integrationAccounts:
      accounts?.map((a) => ({
        id: a.id,
        provider: a.provider,
        displayName: a.display_name,
      })) ?? [],
    processingJobsPending: pj.error ? null : pj.count ?? 0,
    storagePrefixSample: [`${input.orgId}/csv/`],
    explicitPreOrgDeletes: [...EXPLICIT_PRE_ORG_DELETES],
    financeSnapshotRequired: !!billing,
  };
}
