import Link from "next/link";
import { adminSupabase } from "@/lib/supabase/admin";

export const dynamic="force-dynamic";
export default async function StatusPage(){
  let incidents:Array<{id:string;title:string;summary:string;severity:string;state:string;
    started_at:string;resolved_at:string|null}>=[];
  let databaseAvailable=false;
  try{
    const {data,error}=await adminSupabase().from("status_incidents")
      .select("id,title,summary,severity,state,started_at,resolved_at")
      .eq("published",true).order("started_at",{ascending:false}).limit(20);
    if(!error){incidents=data??[];databaseAvailable=true;}
  }catch{}
  const ongoing=incidents.filter((item)=>item.state!=="resolved");
  return <main className="frame page public-copy"><span className="eyebrow">Service status</span>
    <h1>Solvren status and incidents</h1>
    <p className="card" role="status">{!databaseAvailable?"Status data is unavailable; the application or database may be degraded.":
      ongoing.length?`${ongoing.length} published incident${ongoing.length===1?"":"s"} in progress.`:
        "No published active incidents. This page does not replace independent uptime monitoring."}</p>
    <section className="card section"><h2>Published updates</h2>{!databaseAvailable?
      <p>Incident updates cannot be loaded right now.</p>:incidents.length===0?
        <p>No public incidents are recorded.</p>:
      incidents.map((item)=><article className="row" key={item.id}><div><h3>{item.title}</h3>
        <p>{item.summary}</p><small>{new Date(item.started_at).toLocaleString()} · {item.severity} · {item.state}
          {item.resolved_at?` · Resolved ${new Date(item.resolved_at).toLocaleString()}`:""}</small></div></article>)}</section>
    <section className="card section"><h2>How incidents are handled</h2><p>We investigate monitored application and worker failures, classify customer impact, publish material updates here, and notify affected Owners through their account contact when customer data or service availability is materially affected. An incident remains open until service has recovered and the root cause is recorded. The internal availability objective is 99.9% monthly; recovery objectives are 24-hour RPO and RTO. These are operating targets, not a claim of measured uptime or a contractual SLA.</p>
      <p>Report an issue through <Link className="table-link" href="/support">Support</Link>; choose “Security report” for a suspected data incident.</p></section></main>;
}
