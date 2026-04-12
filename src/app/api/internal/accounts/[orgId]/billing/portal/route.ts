import { NextRequest, NextResponse } from "next/server";
import { assertOrganizationExists } from "@/lib/internal/accountQueries";
import { requireInternalEmployeeApi } from "@/lib/internal/auth";
import type { BillingRow } from "@/lib/internal/billingPortal";
import { computePortalEligible } from "@/lib/internal/billingPortal";
import { canAccessInternalTab, internalHasPermission } from "@/lib/internal/permissions";
import { env } from "@/lib/env";
import { getStripe } from "@/lib/stripe";

export const runtime = "nodejs";

function absoluteUrl(path: string) {
  return path.startsWith("http") ? path : `${env.appUrl.replace(/\/$/, "")}${path.startsWith("/") ? path : `/${path}`}`;
}

export async function POST(_req: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
  const gate = await requireInternalEmployeeApi();
  if (!gate.ok) return gate.response;
  if (!internalHasPermission(gate.ctx.employeeRole, "internal.accounts.billing.manage")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const teamManage = internalHasPermission(gate.ctx.employeeRole, "internal.accounts.team.manage");
  if (!canAccessInternalTab(gate.ctx.employeeRole, "billing", { teamManage })) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { orgId } = await params;
  const org = await assertOrganizationExists(gate.ctx.admin, orgId);
  if (!org) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json({ error: "Billing portal unavailable" }, { status: 503 });
  }

  const { data: billing } = await gate.ctx.admin
    .from("billing_accounts")
    .select("stripe_customer_id, status, plan_key, current_period_end")
    .eq("org_id", orgId)
    .maybeSingle();

  const row = (billing as BillingRow | null) ?? null;
  if (!computePortalEligible(row)) {
    return NextResponse.json({ error: "Billing portal unavailable" }, { status: 503 });
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: row!.stripe_customer_id!,
    return_url: absoluteUrl(`/internal/accounts/${orgId}?tab=billing`),
  });

  return NextResponse.json({ ok: true, url: session.url });
}
