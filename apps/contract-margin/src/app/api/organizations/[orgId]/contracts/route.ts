import { z } from "zod";
import { jsonError, requestOrgWriteRole } from "@/lib/api";
import { contractRow } from "@/lib/import-schemas";

export async function POST(request: Request, context: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await context.params;
  if (!z.uuid().safeParse(orgId).success) return jsonError("Organization not found.", 404);
  const session = await requestOrgWriteRole(orgId, ["owner", "finance"]);
  if (!session) return jsonError("Finance access with MFA required.", 403);
  const body = contractRow.safeParse(await request.json().catch(() => null));
  if (!body.success) return jsonError("Enter valid contract terms.", 400);
  const { data, error } = await session.supabase.rpc("create_contract_version", {
    p_org: orgId, p_customer_external_id: body.data.customerId,
    p_customer_name: body.data.customerName, p_effective_from: body.data.effectiveFrom,
    p_billing_period: body.data.billingPeriod, p_base_fee_usd: body.data.baseFeeUsd,
    p_included_outcomes: body.data.includedOutcomes, p_overage_usd: body.data.overageUsd,
    p_discount_pct: body.data.discountPct, p_target_margin_pct: body.data.targetMarginPct ?? null,
    p_renewal_on: body.data.renewalOn ?? null,
  });
  if (error) return jsonError(error.message, 422);
  return Response.json({ contractVersionId: data }, { status: 201 });
}
