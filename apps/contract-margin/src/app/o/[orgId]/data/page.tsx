import Link from "next/link";
import { redirect } from "next/navigation";
import { organizationAccess } from "@/lib/auth";
import { dateRange } from "@/lib/finance";
import { DataConsole } from "./DataConsole";
import { ContractEditor } from "@/components/ContractEditor";

export default async function DataPage({ params, searchParams }: {
  params: Promise<{ orgId: string }>;
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const { orgId } = await params;
  const period = dateRange(await searchParams);
  const { supabase, role } = await organizationAccess(orgId);
  if (!period) redirect(`/o/${orgId}/data`);
  const [orgResult, customersResult, jobsResult, unmappedResult,
    ratesResult, statementsResult, connectionsResult, keysResult] = await Promise.all([
    supabase.from("organizations").select("name,target_margin_pct").eq("id", orgId).single(),
    supabase.from("customers").select("id,name,external_id").eq("org_id", orgId).order("name"),
    supabase.from("import_jobs").select("id,kind,source,file_name,status,total_rows,rejected_rows,imported_rows,duplicate_rows,chunks_done,chunks_total,error_message,created_at")
      .eq("org_id", orgId).order("created_at", { ascending: false }).limit(30),
    supabase.rpc("phase1_unmapped", { p_org: orgId, p_start: period.from, p_end: period.to }),
    supabase.from("model_rates").select("id,provider,model,effective_from,input_per_million_usd,output_per_million_usd,cache_read_per_million_usd,cache_write_per_million_usd")
      .eq("org_id", orgId).order("effective_from", { ascending: false }).limit(50),
    supabase.from("provider_statements").select("id,provider,period_start,period_end,total_usd,source_file")
      .eq("org_id", orgId).order("period_start", { ascending: false }).limit(30),
    supabase.rpc("langfuse_connection_status", { p_org: orgId }),
    role === "owner" || role === "engineer"
      ? supabase.from("ingestion_keys").select("id,label,token_prefix,created_at,last_used_at,revoked_at")
        .eq("org_id", orgId).order("created_at", { ascending: false }).limit(30)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (!orgResult.data) redirect("/workspace");
  const failed = [customersResult, jobsResult, unmappedResult, ratesResult,
    statementsResult, connectionsResult, keysResult].some((result) => result.error);
  if (failed) return <main className="frame page"><h1>Data workspace unavailable</h1><p>We could not load the organization’s data setup. Try again.</p><Link className="button" href={`/o/${orgId}`}>Return to portfolio</Link></main>;
  return <main className="frame page">
    <div className="inline-form"><Link className="button ghost" href={`/o/${orgId}`}>← Portfolio</Link><Link className="button ghost" href={`/o/${orgId}/reconcile`}>Reconcile & reports →</Link></div>
    <div className="intro"><span className="eyebrow">{orgResult.data.name}</span><h1 style={{marginTop:18}}>Data & imports</h1><p>Bring contracts, usage, outcomes, and supplier statements together. Every missing or rejected row stays visible.</p></div>
    <DataConsole orgId={orgId} role={role} period={period} targetMarginPct={String(orgResult.data.target_margin_pct)}
      customers={customersResult.data ?? []} jobs={jobsResult.data ?? []}
      unmapped={unmappedResult.data ?? []} rates={ratesResult.data ?? []}
      statements={statementsResult.data ?? []} connections={connectionsResult.data ?? []}
      keys={keysResult.data ?? []}/>
    {(role === "owner" || role === "finance") && <section className="card section"><h2>Create a contract in Solvren</h2><p>For one contract, use this form. For many, use the contract CSV above. To amend a customer’s terms, open that customer from the portfolio.</p><ContractEditor orgId={orgId}/></section>}
  </main>;
}
