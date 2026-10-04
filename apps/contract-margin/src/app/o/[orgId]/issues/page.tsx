import Link from "next/link";
import { organizationAccess } from "@/lib/auth";
import { usd } from "@/lib/finance";
import { AlertSettings, defaultAlertSettings } from "@/lib/phase3-alerts";
import { AlertSettingsForm } from "./AlertSettingsForm";
import { RetryDeliveryButton } from "./RetryDeliveryButton";

export default async function IssuesPage({params,searchParams}:{params:Promise<{orgId:string}>;
  searchParams:Promise<{page?:string}>}){
  const {orgId}=await params;
  const search=await searchParams;
  const page=search.page&&/^\d+$/.test(search.page)?Math.min(Number(search.page),10000):0;
  const {supabase,role}=await organizationAccess(orgId);
  const [orgResult,issuesResult,summaryResult,settingsResult,monitorResult,
    deliveriesResult,pendingDigestsResult,failedAlertsResult,failedDigestsResult]=await Promise.all([
    supabase.from("organizations").select("name").eq("id",orgId).single(),
    supabase.from("margin_issues")
      .select("id,customer_id,kind,status,severity,exposure_usd,evidence,signal_active,assignee_user_id,first_seen_at,last_seen_at,snoozed_until")
      .eq("org_id",orgId).order("last_seen_at",{ascending:false}).order("id")
      .range(page*100,page*100+99),
    supabase.rpc("phase3_issue_summary",{p_org:orgId}),
    supabase.from("margin_alert_settings").select("*").eq("org_id",orgId).maybeSingle(),
    supabase.from("margin_monitor_state").select("last_success_at,last_error")
      .eq("org_id",orgId).maybeSingle(),
    supabase.from("margin_alert_deliveries").select("id",{count:"exact",head:true})
      .eq("org_id",orgId).in("status",["queued","failed"]),
    supabase.from("executive_digests").select("id",{count:"exact",head:true})
      .eq("org_id",orgId).in("status",["queued","failed"]),
    supabase.from("margin_alert_deliveries").select("id,last_error",{count:"exact"})
      .eq("org_id",orgId).eq("status","failed").order("id",{ascending:false}).limit(3),
    supabase.from("executive_digests").select("id,last_error",{count:"exact"})
      .eq("org_id",orgId).eq("status","failed").order("week_start",{ascending:false}).limit(3),
  ]);
  if(orgResult.error||!orgResult.data||issuesResult.error||summaryResult.error||settingsResult.error||
    monitorResult.error||deliveriesResult.error||pendingDigestsResult.error||
    failedAlertsResult.error||failedDigestsResult.error)
    return <main className="frame page"><h1>Issues unavailable</h1><p>Try again after checking your workspace connection.</p></main>;
  const issues=issuesResult.data??[];
  const summary=summaryResult.data?.[0];
  const finance=role==="owner"||role==="finance";
  return <main className="frame page"><Link className="button ghost" href={`/o/${orgId}`}>← Portfolio</Link>
    <div className="intro"><span className="eyebrow">{orgResult.data.name}</span><h1 style={{marginTop:18}}>Margin issues</h1>
      <p>Every alert is tied to a condition and its source evidence. Assign a person, record a decision, and keep material unresolved issues visible.</p></div>
    <div className="metric-grid"><div className="metric"><span>Open issues</span><strong>{summary?.open_issues??0}</strong><small>Includes acknowledged and snoozed</small></div>
      <div className="metric"><span>Known exposure</span><strong>{usd(summary?.known_exposure_usd??0)}</strong><small>Unpriced costs can increase this amount</small></div>
      <div className="metric"><span>Last successful scan</span><strong style={{fontSize:"1rem"}}>{monitorResult.data?.last_success_at?new Date(monitorResult.data.last_success_at).toLocaleString():"Awaiting first scan"}</strong><small>{monitorResult.data?.last_error??"Hourly condition review"}</small></div>
      <div className="metric"><span>Delivery queue</span><strong>{(deliveriesResult.count??0)+(pendingDigestsResult.count??0)}</strong><small>Queued or failed email attempts</small></div></div>
    <section className="card section"><h2>Action queue</h2><p>Resolved issues remain in history. A condition that clears does not erase an unresolved human decision.</p>
      {issues.length===0?<p>No issues detected. Source coverage and monitor status still deserve review.</p>:
        <div className="table-scroll"><table><thead><tr><th>Condition</th><th>Status</th><th>Exposure</th><th>Owner</th><th>Evidence</th></tr></thead><tbody>{issues.map((issue)=>{
          const evidence=issue.evidence as {customerName?:string;provider?:string;route?:string};
          return <tr key={issue.id}><td><Link className="table-link" href={`/o/${orgId}/issues/${issue.id}`}>{evidence.customerName??evidence.provider??"Organization"}</Link><small>{issue.kind.replaceAll("_"," ")} · {issue.severity}</small></td>
            <td><span className={`pill ${issue.status==="open"?"risk":""}`}>{issue.status}</span><small>{issue.signal_active?"Condition active":"Condition no longer observed"}</small></td>
            <td>{usd(issue.exposure_usd)}</td><td>{issue.assignee_user_id??"Unassigned"}</td>
            <td>{evidence.route?<Link className="table-link" href={evidence.route}>Source report →</Link>:"Review issue"}<small>Last observed {new Date(issue.last_seen_at).toLocaleString()}</small></td></tr>;
        })}</tbody></table></div>}
      <div className="inline-form section">{page>0&&<Link className="button secondary" href={`?page=${page-1}`}>Previous</Link>}{issues.length===100&&<Link className="button secondary" href={`?page=${page+1}`}>Next 100</Link>}</div></section>
    {finance&&((failedAlertsResult.count??0)+(failedDigestsResult.count??0)>0)&&
      <section className="card section"><h2>Email delivery needs attention</h2>
        <p>{failedAlertsResult.count??0} failed alerts and {failedDigestsResult.count??0} failed digests. Check the sender domain and mail service before retrying.</p>
        {[...(failedAlertsResult.data??[]),...(failedDigestsResult.data??[])].map((item)=><p className="small" key={item.id}>{item.last_error??"Delivery failed"}</p>)}
        <RetryDeliveryButton orgId={orgId}/></section>}
    {finance&&<AlertSettingsForm orgId={orgId} initial={(settingsResult.data??defaultAlertSettings) as AlertSettings}/>}
    <p className="section small">Weekly digests report newly at-risk contracts, exposure changes, resolved issues, and data-confidence gaps. They do not claim saved revenue.</p>
  </main>;
}
