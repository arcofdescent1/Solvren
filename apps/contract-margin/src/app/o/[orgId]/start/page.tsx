import Link from "next/link";
import { organizationAccess } from "@/lib/auth";

export default async function GettingStartedPage({params}:{params:Promise<{orgId:string}>}){
  const {orgId}=await params;
  const {supabase}=await organizationAccess(orgId);
  const [members,contracts,usage,outcomes,connections,reports]=await Promise.all([
    supabase.from("organization_members").select("user_id",{head:true,count:"exact"}).eq("org_id",orgId),
    supabase.from("contract_versions").select("id",{head:true,count:"exact"}).eq("org_id",orgId),
    supabase.from("usage_events").select("id",{head:true,count:"exact"}).eq("org_id",orgId),
    supabase.from("outcome_events").select("id",{head:true,count:"exact"}).eq("org_id",orgId),
    supabase.from("provider_connections").select("provider,last_success_at")
      .eq("org_id",orgId).is("disconnected_at",null),
    supabase.from("report_snapshots").select("id",{head:true,count:"exact"})
      .eq("org_id",orgId).eq("status","frozen"),
  ]);
  if([members,contracts,usage,outcomes,connections,reports].some((result)=>result.error))
    return <main className="frame page"><h1>Setup status unavailable</h1>
      <p>We could not verify your source readiness. Try again shortly.</p></main>;
  const steps=[
    {label:"Invite the technical owner",done:(members.count??0)>1,
      detail:"An Engineer can connect supplier data and import AI usage.",href:`/o/${orgId}/team`},
    {label:"Add signed contract terms",done:(contracts.count??0)>0,
      detail:"Revenue must come from confirmed USD contract terms, not a Stripe list-price guess.",href:`/o/${orgId}/data`},
    {label:"Import tagged usage",done:(usage.count??0)>0,
      detail:"Use stable customer, workflow, run, and event IDs in the usage CSV or ingestion API.",href:`/o/${orgId}/data`},
    {label:"Import completed outcomes",done:(outcomes.count??0)>0,
      detail:"Outcome IDs connect delivery cost to billable completed work.",href:`/o/${orgId}/data`},
    {label:"Connect a supplier cost source",done:(connections.data??[]).some((item)=>item.last_success_at),
      detail:"OpenAI or Anthropic organization-admin cost evidence allows reconciliation.",href:`/o/${orgId}/reconcile`},
    {label:"Review gaps and freeze a report",done:(reports.count??0)>0,
      detail:"Confirm mappings, unknown models, supplier variance, and the report preview before freezing.",href:`/o/${orgId}/reconcile`},
  ];
  const next=steps.find((step)=>!step.done);
  return <main className="frame page"><Link className="button ghost" href={`/o/${orgId}`}>← Portfolio</Link>
    <div className="intro"><span className="eyebrow">First report</span><h1 style={{marginTop:18}}>Set up a source-backed margin review</h1>
      <p>Complete these steps in order. A missing step stays visible instead of producing a plausible but unsupported margin.</p></div>
    <div className="metric-grid"><div className="metric"><span>Ready steps</span><strong>{steps.filter((step)=>step.done).length} / {steps.length}</strong></div>
      <div className="metric"><span>Next action</span><strong style={{fontSize:"1rem"}}>{next?.label??"Review your report"}</strong></div></div>
    <section className="card section"><h2>Onboarding checklist</h2>{steps.map((step,index)=><div className="row" key={step.label}>
      <div><b>{step.done?"✓":"○"} {index+1}. {step.label}</b><p className="small">{step.detail}</p></div>
      <Link className="button secondary" href={step.href}>{step.done?"Review":"Complete step"}</Link></div>)}</section>
    <div className="inline-form section"><Link className="button secondary" href={`/o/${orgId}/guide`}>Field and formula guide</Link>
      <Link className="button secondary" href={`/o/${orgId}/reconcile`}>Report preview and gaps</Link></div>
  </main>;
}
