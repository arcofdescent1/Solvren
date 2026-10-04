import Link from "next/link";
import { notFound } from "next/navigation";
import { organizationAccess } from "@/lib/auth";
import { usd } from "@/lib/finance";
import { IssueActions } from "./IssueActions";

export default async function IssuePage({params,searchParams}:{
  params:Promise<{orgId:string;issueId:string}>;
  searchParams:Promise<{before?:string}>;
}){
  const {orgId,issueId}=await params;
  const search=await searchParams;
  const {supabase,role}=await organizationAccess(orgId);
  const canAct=role==="owner"||role==="finance"||role==="engineer";
  const before=search.before&&/^\d+$/.test(search.before)?Number(search.before):null;
  const [issueResult,membersResult,eventsResult]=await Promise.all([
    supabase.from("margin_issues").select("id,customer_id,kind,status,severity,exposure_usd,evidence,signal_active,assignee_user_id,snoozed_until,first_seen_at,last_seen_at,occurrence_count")
      .eq("org_id",orgId).eq("id",issueId).maybeSingle(),
    canAct?supabase.rpc("phase3_member_picker",{p_org:orgId})
      :Promise.resolve({data:[],error:null}),
    supabase.from("margin_issue_events")
      .select("id,event_type,actor_user_id,note,details,created_at")
      .eq("org_id",orgId).eq("issue_id",issueId)
      .lt("id",before??Number.MAX_SAFE_INTEGER)
      .order("id",{ascending:false}).limit(100),
  ]);
  if(!issueResult.data)notFound();
  if(membersResult.error||eventsResult.error)
    return <main className="frame page"><h1>Issue history unavailable</h1><Link href={`/o/${orgId}/issues`}>Return to issues</Link></main>;
  const issue=issueResult.data;
  const evidence=issue.evidence as Record<string,unknown>;
  const route=typeof evidence.route==="string"&&evidence.route.startsWith(`/o/${orgId}/`)
    ?evidence.route:null;
  const events=eventsResult.data??[];
  return <main className="frame page"><Link className="button ghost" href={`/o/${orgId}/issues`}>← Issues</Link>
    <div className="intro"><span className="eyebrow">{issue.severity} · {issue.status}</span>
      <h1 style={{marginTop:18}}>{issue.kind.replaceAll("_"," ")}</h1>
      <p>{String(evidence.customerName??evidence.provider??"Organization")} · first observed {new Date(issue.first_seen_at).toLocaleString()} · last observed {new Date(issue.last_seen_at).toLocaleString()}.</p></div>
    <div className="metric-grid"><div className="metric"><span>Known exposure</span><strong>{usd(issue.exposure_usd)}</strong><small>Unpriced costs may increase it</small></div>
      <div className="metric"><span>Signal</span><strong style={{fontSize:"1rem"}}>{issue.signal_active?"Active":"No longer observed"}</strong><small>{issue.occurrence_count} monitor observations</small></div>
      <div className="metric"><span>Assignee</span><strong style={{fontSize:"1rem"}}>{(membersResult.data??[]).find((m:{user_id:string;email:string})=>m.user_id===issue.assignee_user_id)?.email??"Unassigned"}</strong><small>Decision owner</small></div>
      <div className="metric"><span>Snoozed until</span><strong style={{fontSize:"1rem"}}>{issue.snoozed_until?new Date(issue.snoozed_until).toLocaleString():"Not snoozed"}</strong><small>Unresolved issues remain on the queue</small></div></div>
    <section className="card section"><h2>Evidence</h2><p>Current observation and measured inputs. Historical state changes are below.</p>
      <div className="table-scroll"><table><tbody>{Object.entries(evidence).filter(([key])=>key!=="route").map(([key,value])=><tr key={key}><th>{key.replaceAll(/([A-Z])/g," $1")}</th><td>{value===null?"Unavailable":typeof value==="object"?JSON.stringify(value):String(value)}</td></tr>)}</tbody></table></div>
      {route&&<Link className="button secondary section" href={route}>Open source report →</Link>}
    </section>
    {canAct&&<IssueActions orgId={orgId} issueId={issueId} status={issue.status}
      members={membersResult.data??[]}/>}
    <section className="card section"><h2>Action history</h2><p>Each acknowledgment, assignment, snooze, comment, resolution, and renewed detection is recorded.</p>
      {events.map((event)=><div className="row" key={event.id}><div><b>{event.event_type.replaceAll("_"," ")}</b><div className="row-sub">{new Date(event.created_at).toLocaleString()} · {event.actor_user_id??"System monitor"}</div>
        {event.note&&<p style={{marginTop:8}}>{event.note}</p>}</div></div>)}
      {events.length===100&&<Link className="button secondary" href={`?before=${events.at(-1)?.id}`}>Older history</Link>}
    </section>
  </main>;
}
