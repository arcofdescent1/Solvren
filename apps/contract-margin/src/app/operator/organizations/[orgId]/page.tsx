import Link from "next/link";
import { notFound } from "next/navigation";
import { adminSupabase } from "@/lib/supabase/admin";
import { activeOperator } from "@/lib/operator";

export const dynamic="force-dynamic";
export default async function OrganizationDiagnostics({params}:{params:Promise<{orgId:string}>}){
  const {orgId}=await params;
  const operator=await activeOperator();
  if(!operator||!/^[0-9a-f-]{36}$/i.test(orgId))notFound();
  const db=adminSupabase();
  const [org,billing,connections,imports,connectors,monitor,alerts]=await Promise.all([
    db.from("organizations").select("name,created_at").eq("id",orgId).single(),
    db.from("organization_billing").select("status,plan_interval,current_period_end,trial_ends_at")
      .eq("org_id",orgId).single(),
    db.from("provider_connections").select("provider,connected_at,last_success_at,last_error,disconnected_at")
      .eq("org_id",orgId),
    db.from("import_jobs").select("id,kind,status,error_message,created_at")
      .eq("org_id",orgId).order("created_at",{ascending:false}).limit(20),
    db.from("connector_jobs").select("id,provider,status,last_error,created_at")
      .eq("org_id",orgId).order("created_at",{ascending:false}).limit(20),
    db.from("margin_monitor_state").select("last_success_at,last_error")
      .eq("org_id",orgId).maybeSingle(),
    db.from("margin_alert_deliveries").select("status,last_error,due_at")
      .eq("org_id",orgId).order("id",{ascending:false}).limit(20),
  ]);
  if(org.error||!org.data)notFound();
  if([billing,connections,imports,connectors,monitor,alerts].some((result)=>result.error))
    return <main className="frame page"><h1>Diagnostics unavailable</h1></main>;
  const {error:auditError}=await db.rpc("phase4_operator_activity",{
    p_grant:operator.grant.grant_id,p_action:"organization_diagnostics",
    p_org:orgId,p_target:orgId,p_details:{},
  });
  if(auditError)return <main className="frame page"><h1>Operator audit unavailable</h1></main>;
  return <main className="frame page"><Link className="button ghost" href="/operator">← Operator console</Link>
    <h1>{org.data.name} · diagnostics</h1><p>Operational metadata only. This view does not expose contracts, revenue, or usage records.</p>
    <div className="metric-grid"><div className="metric"><span>Billing state</span>
      <strong>{billing.data?.status??"unknown"}</strong></div>
      <div className="metric"><span>Last margin scan</span><strong style={{fontSize:"1rem"}}>
        {monitor.data?.last_success_at?new Date(monitor.data.last_success_at).toLocaleString():"Never"}</strong></div></div>
    <section className="card section"><h2>Source connections</h2>{(connections.data??[]).map((item)=><div className="row" key={item.provider}>
      <b>{item.provider}</b><span>{item.disconnected_at?"Disconnected":item.last_success_at?
        `Last success ${new Date(item.last_success_at).toLocaleString()}`:"Awaiting first sync"}</span>
      <span className="small">{item.last_error??"No recorded error"}</span></div>)}</section>
    <section className="card section"><h2>Recent import failures</h2>{(imports.data??[]).filter((item)=>item.status==="failed").map((item)=><div className="row" key={item.id}>
      <span>{item.kind} · {new Date(item.created_at).toLocaleString()}</span><span>{item.error_message??"Failure recorded"}</span></div>)}
      <h2 className="section">Recent connector failures</h2>{(connectors.data??[]).filter((item)=>item.status==="failed").map((item)=><div className="row" key={item.id}>
        <span>{item.provider} · {new Date(item.created_at).toLocaleString()}</span><span>{item.last_error??"Failure recorded"}</span></div>)}</section>
    <section className="card section"><h2>Monitor and delivery</h2><p>{monitor.data?.last_error??"No scan error"}</p>
      {(alerts.data??[]).filter((item)=>item.status==="failed").map((item,index)=><p key={index}>
        {item.due_at}: {item.last_error??"Delivery failed"}</p>)}</section>
  </main>;
}
