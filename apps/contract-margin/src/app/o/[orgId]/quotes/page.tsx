import Link from "next/link";
import { organizationAccess } from "@/lib/auth";
import { WorkflowSample } from "@/lib/quote-finance";
import { QuoteConsole } from "./QuoteConsole";

export default async function QuotesPage({ params,searchParams }: { params: Promise<{ orgId: string }>;
  searchParams:Promise<{page?:string}> }) {
  const { orgId } = await params;
  const search=await searchParams;
  const page=search.page&&/^\d+$/.test(search.page)?Math.min(Number(search.page),10000):0;
  const { supabase, role } = await organizationAccess(orgId);
  const end = new Date(); end.setUTCHours(0,0,0,0);
  const start = new Date(end); start.setUTCDate(start.getUTCDate() - 60);
  const [org, samples, members, saved] = await Promise.all([
    supabase.from("organizations").select("name,target_margin_pct").eq("id",orgId).single(),
    supabase.rpc("phase3_workflow_samples", { p_org: orgId,
      p_start: start.toISOString().slice(0,10), p_end: end.toISOString().slice(0,10) }),
    role === "owner" || role === "finance" ? supabase.rpc("organization_member_picker", { p_org: orgId })
      : Promise.resolve({ data: [], error: null }),
    supabase.from("quote_decisions")
      .select("id,quote_id,version,customer_name,owner_user_id,decision,notes,scenario_input,scenario_results,sample_snapshot,saved_at")
      .eq("org_id",orgId).order("saved_at",{ascending:false}).order("id",{ascending:false})
      .range(page*50,page*50+49),
  ]);
  if (org.error || samples.error || members.error || saved.error || !org.data)
    return <main className="frame page"><h1>Quote review unavailable</h1><p>Check the workspace data and try again.</p><Link href={`/o/${orgId}`} className="button">Portfolio</Link></main>;
  const canDecide = role === "owner" || role === "finance";
  return <main className="frame page"><Link href={`/o/${orgId}`} className="button ghost">← Portfolio</Link>
    <div className="intro"><span className="eyebrow">{org.data.name}</span><h1 style={{marginTop:18}}>Quote decisions</h1>
      <p>Compare proposed terms against observed completed-run costs. Each approval keeps its assumptions, evidence, and calculation so a future edit cannot rewrite the decision.</p></div>
    {canDecide ? <QuoteConsole orgId={orgId} defaultTarget={String(org.data.target_margin_pct)}
      samples={(samples.data ?? []) as WorkflowSample[]} members={members.data ?? []}
      saved={saved.data ?? []}/> : <p className="card">Finance or Owner access is required to create decisions.</p>}
    <section className="card section"><h2>Decision history</h2><p>Saved versions are immutable. A changed assumption creates a new version.</p>
      {(saved.data ?? []).length === 0 ? <p>No decisions saved.</p> : (saved.data ?? []).map((item) => {
        const results = item.scenario_results as Array<{ label:string; confidence:string;
          adverse:{ marginPct:string|null; contributionUsd:string }; recommendation:string }>;
        return <details className="row" key={item.id}><summary className="table-link">{item.customer_name} · {item.decision} · version {item.version} · {new Date(item.saved_at).toLocaleString()}</summary>
          <div className="stack" style={{width:"100%",paddingTop:14}}><p>{item.notes}</p>
            {results.map((result) => <p key={result.label}><b>{result.label}</b> · adverse contribution {result.adverse.contributionUsd} USD · {result.adverse.marginPct ?? "n/a"}% margin · {result.confidence}. {result.recommendation}</p>)}
            <p className="small">Evidence and assumptions were frozen at approval. Owner: {item.owner_user_id}.</p></div></details>;
      })}
      <div className="inline-form section">{page>0&&<Link className="button secondary" href={`?page=${page-1}`}>Previous</Link>}
        {(saved.data??[]).length===50&&<Link className="button secondary" href={`?page=${page+1}`}>Next 50</Link>}</div></section>
  </main>;
}
