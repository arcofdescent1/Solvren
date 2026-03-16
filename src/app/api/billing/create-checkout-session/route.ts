import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { env } from "@/lib/env";
import { getStripe } from "@/lib/stripe";
import { isAdminLikeRole, parseOrgRole } from "@/lib/rbac/roles";

type Body = { orgId: string; plan: "TEAM" | "BUSINESS" };

function absoluteUrl(path: string) {
  return path.startsWith("http") ? path : `${env.appUrl}${path}`;
}

function priceIdForPlan(plan: "TEAM" | "BUSINESS") {
  if (plan === "TEAM") return env.stripePriceTeam!;
  return env.stripePriceBusiness!;
}

export async function POST(req: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as Body | null;
  if (!body?.orgId || !body?.plan) {
    return NextResponse.json(
      { error: "orgId and plan required" },
      { status: 400 }
    );
  }

  const { data: member } = await supabase
    .from("organization_members")
    .select("role")
    .eq("org_id", body.orgId)
    .eq("user_id", userRes.user.id)
    .maybeSingle();

  if (!member)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!isAdminLikeRole(parseOrgRole(member.role ?? null)))
    return NextResponse.json({ error: "Owner/Admin required" }, { status: 403 });

  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json(
      { error: "Billing integration disabled: Stripe not configured" },
      { status: 503 }
    );
  }

  const admin = createAdminClient();

  const { data: billing } = await admin
    .from("billing_accounts")
    .select("stripe_customer_id")
    .eq("org_id", body.orgId)
    .maybeSingle();

  let customerId = billing?.stripe_customer_id ?? null;

  if (!customerId) {
    const customer = await stripe.customers.create({
      email: userRes.user.email ?? undefined,
      metadata: { org_id: body.orgId },
    });
    customerId = customer.id;

    await admin.from("billing_accounts").upsert(
      {
        org_id: body.orgId,
        stripe_customer_id: customerId,
        plan_key: "FREE",
        status: "ACTIVE",
      },
      { onConflict: "org_id" }
    );
  }

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: priceIdForPlan(body.plan), quantity: 1 }],
    allow_promotion_codes: true,
    success_url: absoluteUrl("/org/settings?billing=success"),
    cancel_url: absoluteUrl("/org/settings?billing=cancel"),
    automatic_tax: { enabled: true },
    client_reference_id: body.orgId,
    subscription_data: {
      metadata: { org_id: body.orgId, plan_key: body.plan },
    },
  });

  return NextResponse.json({ ok: true, url: session.url });
}
