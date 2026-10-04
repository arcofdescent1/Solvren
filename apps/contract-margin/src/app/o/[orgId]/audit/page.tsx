import Link from "next/link";
import { organizationAccess } from "@/lib/auth";

export default async function AuditPage({params,searchParams}:{params:Promise<{orgId:string}>;
  searchParams:Promise<{page?:string}>}){
  const {orgId}=await params;
  const search=await searchParams;
  const page=search.page&&/^\d+$/.test(search.page)?Math.min(Number(search.page),10000):0;
  const {supabase,role}=await organizationAccess(orgId,true);
  if(role!=="owner")return <main className="frame page"><h1>Owner access required</h1></main>;
  const [events,chain]=await Promise.all([
    supabase.from("organization_audit_events")
      .select("id,actor_user_id,event_type,entity_id,details,created_at,event_hash")
      .eq("org_id",orgId).order("id",{ascending:false})
      .range(page*100,page*100+99),
    supabase.rpc("phase4_audit_chain_valid",{p_org:orgId}),
  ]);
  if(events.error||chain.error)return <main className="frame page"><h1>Audit history unavailable</h1>
    <p>Access or integrity verification failed. Contact support.</p></main>;
  return <main className="frame page"><Link className="button ghost" href={`/o/${orgId}`}>
    ← Portfolio</Link><div className="intro"><span className="eyebrow">Owner controls</span>
      <h1 style={{marginTop:18}}>Audit history</h1><p>Organization changes, access, exports, reports, billing, and support events are time-stamped in a chained append-only record.</p></div>
    <p className={`card ${chain.data?"":"message error"}`} role="status">
      Chain verification: <strong>{chain.data?"Valid":"Failed — contact security support"}</strong>.
      Each event includes the preceding event hash; deletion or modification breaks this check.</p>
    <section className="card section"><h2>Recent events</h2>{(events.data??[]).length===0?<p>No recorded events yet.</p>:
      <div className="table-scroll"><table><thead><tr><th>Time</th><th>Event</th><th>Actor</th><th>Entity</th><th>Details</th></tr></thead><tbody>
        {(events.data??[]).map((item)=><tr key={item.id}><td>{new Date(item.created_at).toLocaleString()}</td>
          <td>{item.event_type.replaceAll("_"," ")}</td><td>{item.actor_user_id??"System"}</td>
          <td>{item.entity_id??"—"}</td><td><code className="small">{JSON.stringify(item.details)}</code></td></tr>)}
      </tbody></table></div>}
      <div className="inline-form section">{page>0&&<Link className="button secondary" href={`?page=${page-1}`}>Previous</Link>}
        {(events.data??[]).length===100&&<Link className="button secondary" href={`?page=${page+1}`}>Next 100</Link>}</div></section></main>;
}
