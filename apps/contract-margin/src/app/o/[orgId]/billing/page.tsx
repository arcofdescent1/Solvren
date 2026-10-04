import Link from "next/link";
import { organizationAccess } from "@/lib/auth";
import { BillingActions } from "./BillingActions";

type Entitlement={status:string;trial_ends_at:string;current_period_end:string|null;
  cancel_at_period_end:boolean;plan_interval:string|null;can_write:boolean;
  stripe_customer_id:string|null;event_count:number};
export default async function BillingPage({params,searchParams}:{params:Promise<{orgId:string}>;
  searchParams:Promise<{checkout?:string}>}){
  const {orgId}=await params;
  const {checkout}=await searchParams;
  const {supabase,role}=await organizationAccess(orgId);
  const {data,error}=await supabase.rpc("organization_entitlement",{p_org:orgId});
  if(error||!data?.[0])return <main className="frame page"><h1>Billing unavailable</h1>
    <p>We could not verify this organization’s billing state. Please try again.</p></main>;
  const entitlement=data[0] as Entitlement;
  const {data:refund}=await supabase.from("organization_billing")
    .select("last_refund_at,last_refund_amount_cents").eq("org_id",orgId).maybeSingle();
  const hasSubscription=!!entitlement.plan_interval&&entitlement.status!=="canceled";
  return <main className="frame page"><Link className="button ghost" href={`/o/${orgId}`}>
    ← Portfolio</Link><div className="intro"><span className="eyebrow">Subscription</span>
    <h1 style={{marginTop:18}}>Billing & access</h1>
    <p>View your verified access state and manage payment through Stripe.</p></div>
    {checkout==="success"&&<p className="card" role="status">Checkout returned successfully. Access updates after Stripe confirms the subscription; refresh this page if confirmation is still in progress.</p>}
    {refund?.last_refund_at&&<p className="card" role="status">Latest recorded refund: ${(Number(refund.last_refund_amount_cents)/100).toFixed(2)} on {new Date(refund.last_refund_at).toLocaleDateString()}. A refund does not itself cancel the subscription; use the billing portal to review its current status.</p>}
    <div className="metric-grid"><div className="metric"><span>Access</span>
      <strong>{entitlement.can_write?"Active":"Read-only"}</strong>
      <small>{entitlement.status.replaceAll("_"," ")}</small></div>
      <div className="metric"><span>Plan</span><strong>{entitlement.plan_interval===null?"Trial":entitlement.plan_interval==="month"?"Monthly":"Annual"}</strong>
        <small>{entitlement.cancel_at_period_end?"Cancels at period end":"Current billing interval"}</small></div>
      <div className="metric"><span>{entitlement.status==="trial"?"Trial ends":"Current period ends"}</span>
        <strong style={{fontSize:"1rem"}}>{new Date(entitlement.status==="trial"?
          entitlement.trial_ends_at:entitlement.current_period_end??entitlement.trial_ends_at)
          .toLocaleDateString()}</strong><small>UTC billing boundary</small></div>
      <div className="metric"><span>Events this month</span>
        <strong>{Number(entitlement.event_count).toLocaleString()}</strong>
        <small>of 2,000,000 normalized events</small></div></div>
    <section className="card section"><h2>What the plan includes</h2>
      <p>Two direct supplier connections, up to two million normalized events per calendar month, contract margin reports, quote decisions, issues, and weekly digests. The 14-day trial includes one frozen historical audit and one saved scenario. After trial expiry, existing data remains readable and paid access restores writes without reimporting it.</p>
      {Number(entitlement.event_count)>=1_600_000&&<p className="message">You have used at least 80% of this month’s event allowance. New ingestion stops at two million events; previously accepted data remains available.</p>}
      {role==="owner"?<BillingActions orgId={orgId}
        hasCustomer={!!entitlement.stripe_customer_id} hasSubscription={hasSubscription}/>:
        <p>Only the organization Owner can change billing. Ask your Owner to open this page.</p>}
    </section>
    <p className="section small">Prices are USD and exclude applicable tax. Stripe hosts payment methods and invoices. Solvren does not store card numbers.</p>
  </main>;
}
