import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { env } from "@/lib/env";
import { getStripe } from "@/lib/stripe";
import { isAdminLikeRole, parseOrgRole } from "@/lib/rbac/roles";

type Body = { orgId: string };

function absoluteUrl(path: string) {
  return path.startsWith("http") ? path : `${env.appUrl}${path}`;
}

export async function POST(req: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as Body | null;
  if (!body?.orgId)
    return NextResponse.json(
      { error: "orgId required" },
      { status: 400 }
    );

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

  if (!billing?.stripe_customer_id) {
    return NextResponse.json(
      { error: "No billing account found" },
      { status: 400 }
    );
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: billing.stripe_customer_id,
    return_url: absoluteUrl("/org/settings"),
  });

  return NextResponse.json({ ok: true, url: session.url });
}
