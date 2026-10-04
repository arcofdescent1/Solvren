import Link from "next/link";
import { redirect } from "next/navigation";
import { adminSupabase } from "@/lib/supabase/admin";
import { operatorGrant,operatorIdentity } from "@/lib/operator";
import { OperatorAccessForm } from "./OperatorAccessForm";
import { OperatorActions,RetryLifecycle } from "./OperatorActions";

export const dynamic="force-dynamic";
export default async function OperatorPage(){
  const session=await operatorIdentity();
  if(!session)redirect("/workspace");
  const grant=await operatorGrant(session.user.id);
  if(!grant)return <main className="frame page"><span className="eyebrow">Restricted operations</span>
    <h1>Operator diagnostics</h1><OperatorAccessForm active={false}/></main>;
  const db=adminSupabase();
  const [tickets,incidents,failedImports,failedConnectors,failedAlerts,pastDue,
    deliveries,queuedJobs,funnel]=await Promise.all([
    db.from("support_tickets").select("id,case_number,org_id,category,subject,status,created_at,expected_response_at")
      .neq("status","resolved").order("created_at",{ascending:false}).limit(50),
    db.from("status_incidents").select("id,title,summary,severity,state,published,started_at")
      .order("started_at",{ascending:false}).limit(20),
    db.from("import_jobs").select("id",{count:"exact",head:true}).eq("status","failed"),
    db.from("connector_jobs").select("id",{count:"exact",head:true}).eq("status","failed"),
    db.from("margin_alert_deliveries").select("id",{count:"exact",head:true}).eq("status","failed"),
    db.from("organization_billing").select("org_id",{count:"exact",head:true}).eq("status","past_due"),
    db.from("lifecycle_deliveries").select("id,template,recipient_email,last_error,created_at")
      .eq("status","failed").order("created_at",{ascending:false}).limit(25),
    db.from("import_jobs").select("created_at").eq("status","queued")
      .order("created_at",{ascending:true}).limit(1),
    db.rpc("phase4_funnel_summary"),
  ]);
  if([tickets,incidents,failedImports,failedConnectors,failedAlerts,pastDue,
    deliveries,queuedJobs,funnel].some((item)=>item.error))
    return <main className="frame page"><h1>Diagnostics unavailable</h1><p>Check the operator service and try again.</p></main>;
  const {error:auditError}=await db.rpc("phase4_operator_activity",{
    p_grant:grant.grant_id,p_action:"diagnostics_view",p_org:null,p_target:null,
    p_details:{surface:"overview"},
  });
  if(auditError)return <main className="frame page"><h1>Operator audit unavailable</h1></main>;
  return <main className="frame page"><div className="toolbar"><span className="eyebrow">Restricted operations</span>
    <OperatorAccessForm active/></div><h1>Operator diagnostics</h1>
    <p>Approved session expires {new Date(grant.expires_at).toLocaleString()}. Reason: {grant.reason}. This view exposes job health and support case metadata, not customer contract records.</p>
    <div className="metric-grid"><div className="metric"><span>Failed imports</span><strong>{failedImports.count??0}</strong></div>
      <div className="metric"><span>Failed source syncs</span><strong>{failedConnectors.count??0}</strong></div>
      <div className="metric"><span>Failed alerts</span><strong>{failedAlerts.count??0}</strong></div>
      <div className="metric"><span>Past-due subscriptions</span><strong>{pastDue.count??0}</strong></div></div>
    <p className="small">Oldest queued import: {queuedJobs.data?.[0]?.created_at?
      new Date(queuedJobs.data[0].created_at).toLocaleString():"None"}. Review failed deliveries and support deadlines below.</p>
    <section className="card section"><h2>90-day conversion milestones</h2>
      <div className="metric-grid">{["visit","signup","first_import","first_report","paid","paid_retained"].map((name)=>
        <div className="metric" key={name}><span>{name.replaceAll("_"," ")}</span>
          <strong>{(funnel.data as Array<{event_name:string;event_count:number}>|null)
            ?.find((entry)=>entry.event_name===name)?.event_count??0}</strong></div>)}</div>
      <p className="small">Visits are counted only after analytics consent. These are aggregate milestones, not a matched user funnel.</p>
    </section>
    <section className="card section"><h2>Open support cases</h2>{(tickets.data??[]).length===0?<p>No open cases.</p>:
      <div className="table-scroll"><table><thead><tr><th>Case</th><th>Subject</th><th>Category</th><th>Created</th><th>Due</th><th>Status</th><th>Action</th></tr></thead><tbody>
        {(tickets.data??[]).map((item)=><tr key={item.id}><td>SV-{String(item.case_number).padStart(6,"0")}</td>
          <td>{item.subject}{item.org_id&&<small><Link className="table-link" href={`/operator/organizations/${item.org_id}`}>Organization diagnostics →</Link></small>}</td>
          <td>{item.category}</td><td>{new Date(item.created_at).toLocaleString()}</td>
          <td>{new Date(item.expected_response_at).toLocaleString()}</td><td>{item.status}</td>
          <td><OperatorActions kind="ticket" id={item.id} state={item.status}/></td></tr>)}
      </tbody></table></div>}</section>
    <section className="card section"><h2>Failed lifecycle email</h2>
      {(deliveries.data??[]).length===0?<p>No failed lifecycle deliveries.</p>:
        (deliveries.data??[]).map((item)=><div className="row" key={item.id}>
          <div><b>{item.template.replaceAll("_"," ")}</b><p>{item.recipient_email}</p>
            <small>{item.last_error??"Delivery failed"} · {new Date(item.created_at).toLocaleString()}</small></div>
          <RetryLifecycle id={item.id}/></div>)}</section>
    <section className="card section"><h2>Published and draft incidents</h2>
      <OperatorActions kind="new-incident" id="" state=""/>
      {(incidents.data??[]).map((item)=><div className="row" key={item.id}><div><b>{item.title}</b>
        <p>{item.summary}</p><small>{item.severity} · {item.state} · {item.published?"Public":"Draft"}</small></div>
        <OperatorActions kind="incident" id={item.id} state={item.state}/></div>)}</section>
  </main>;
}
