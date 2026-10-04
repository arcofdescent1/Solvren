import Link from "next/link";
import Decimal from "decimal.js";
import { notFound } from "next/navigation";
import { organizationAccess } from "@/lib/auth";
import { contribution, contributionRate, dateRange, exposure, PortfolioRow, usd } from "@/lib/finance";
import { ContractEditor } from "@/components/ContractEditor";
import { CustomerOwnerPicker } from "@/components/CustomerOwnerPicker";

type Contract = { id: string; version: number; effective_from: string; effective_to: string | null;
  billing_period: string; base_fee_usd: string; included_outcomes: number; overage_usd: string;
  discount_pct: string; target_margin_pct: string | null; renewal_on: string | null };
type Day = { day: string; model_cost_usd: string; direct_cost_usd: string;
  unknown_cost_events: number; completed_outcomes: number };
type Workflow = { workflow_id: string; model_cost_usd: string; tool_cost_usd: string;
  human_cost_usd: string; other_cost_usd: string; unknown_cost_events: number };
type Source = { event_id: number; source: string; source_event_id: string; occurred_at: string;
  workflow_id: string; run_id: string; provider: string; model: string;
  cost_usd: string | null; cost_basis: string; input_tokens: number; output_tokens: number };
type Distribution = { completed_runs: number; median_completed_run_usd: string | null;
  p90_completed_run_usd: string | null; maximum_completed_run_usd: string | null;
  completed_runs_with_unknown_cost: number };

export default async function CustomerPage({ params, searchParams }: {
  params: Promise<{ orgId: string; customerId: string }>;
  searchParams: Promise<{ from?: string; to?: string; before?: string }>;
}) {
  const { orgId, customerId } = await params;
  const search = await searchParams;
  const period = dateRange(search);
  if (!period) notFound();
  const { supabase, role } = await organizationAccess(orgId);
  const canEdit = role === "owner" || role === "finance";
  const before = search.before && /^\d+$/.test(search.before) ? Number(search.before) : null;
  const [customerResult, contractsResult, portfolioResult, dailyResult,
    workflowsResult, distributionResult, sourcesResult, membersResult] = await Promise.all([
    supabase.from("customers").select("id,name,external_id,owner_user_id").eq("org_id", orgId).eq("id", customerId).maybeSingle(),
    supabase.from("contract_versions").select("id,version,effective_from,effective_to,billing_period,base_fee_usd,included_outcomes,overage_usd,discount_pct,target_margin_pct,renewal_on")
      .eq("org_id", orgId).eq("customer_id", customerId).order("version", { ascending: false }),
    supabase.rpc("phase1_portfolio", { p_org: orgId, p_start: period.from, p_end: period.to }),
    supabase.rpc("phase1_customer_daily", { p_org: orgId, p_customer: customerId, p_start: period.from, p_end: period.to }),
    supabase.rpc("phase1_workflow_costs", { p_org: orgId, p_customer: customerId, p_start: period.from, p_end: period.to }),
    supabase.rpc("phase1_run_distribution", { p_org: orgId, p_customer: customerId, p_start: period.from, p_end: period.to }),
    supabase.rpc("phase1_customer_sources", { p_org: orgId, p_customer: customerId,
      p_start: period.from, p_end: period.to, p_before: before, p_limit: 100 }),
    canEdit ? supabase.rpc("organization_member_picker", { p_org: orgId })
      : Promise.resolve({ data: [], error: null }),
  ]);
  const customer = customerResult.data;
  if (!customer) notFound();
  if ([contractsResult, portfolioResult, dailyResult, workflowsResult,
    distributionResult, sourcesResult, membersResult].some((result) => result.error))
    return <main className="frame page"><h1>Customer report unavailable</h1><p>Try again after checking import activity.</p><Link className="button" href={`/o/${orgId}/data`}>Data & imports</Link></main>;
  const row = ((portfolioResult.data ?? []) as PortfolioRow[]).find((item) => item.customer_id === customerId);
  const contracts = (contractsResult.data ?? []) as Contract[];
  const daily = (dailyResult.data ?? []) as Day[];
  const workflows = (workflowsResult.data ?? []) as Workflow[];
  const distribution = ((distributionResult.data ?? []) as Distribution[])[0];
  const sources = (sourcesResult.data ?? []) as Source[];
  const newest = contracts[0];
  const highestDay = Decimal.max(1, ...daily.map((day) => new Decimal(day.model_cost_usd).plus(day.direct_cost_usd)));
  const knownCost = new Decimal(row?.known_cost_usd ?? 0);
  const completed = Number(row?.completed_outcomes ?? 0);
  const now = new Date();
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString().slice(0, 10);
  const elapsedDays = daily.filter((day) => day.day < today).length;
  const projectedCost = period.to > today && elapsedDays >= 3
    ? knownCost.div(elapsedDays).times(period.days) : null;
  const base = `/o/${orgId}/customers/${customerId}`;
  return <main className="frame page">
    <Link className="button ghost" href={`/o/${orgId}?from=${period.from}&to=${period.to}`}>← Portfolio</Link>
    <div className="intro"><span className="eyebrow">Contract evidence · {customer.external_id}</span><h1 style={{marginTop:18}}>{customer.name}</h1><p>Observed usage and contract economics for {period.from} through {period.to} (end exclusive). Every amount follows the effective version of the contract.</p></div>
    {row && <div className="metric-grid"><div className="metric"><span>Contract revenue</span><strong>{usd(row.revenue_usd)}</strong><small>Base fee and observed overage</small></div><div className="metric"><span>Known direct cost</span><strong>{usd(row.known_cost_usd)}</strong><small>{row.unknown_cost_events} unpriced events</small></div><div className="metric"><span>Contribution upper bound</span><strong>{usd(contribution(row))}</strong><small>{contributionRate(row)?.toDecimalPlaces(1).toString() ?? "n/a"}% of revenue</small></div><div className="metric"><span>Floor variance</span><strong>{usd(exposure(row))}</strong><small>Known dollars above {row.target_margin_pct}% target cost limit</small></div></div>}
    <div className="grid section"><section className="card"><h2>Outcome economics</h2><p>Known cost includes failed attempts, tool work, and review. It is a lower bound when usage is unpriced.</p><div className="metric" style={{boxShadow:"none"}}><span>Known cost per completed outcome</span><strong>{completed ? usd(knownCost.div(completed)) : "Unavailable"}</strong><small>{completed} completed · {row?.failed_outcomes ?? 0} failed · {row?.unknown_cost_events ?? 0} unpriced events</small></div><div className="row"><span>Median completed-run cost</span><b>{distribution?.median_completed_run_usd ? usd(distribution.median_completed_run_usd) : "Unavailable"}</b></div><div className="row"><span>90th percentile completed run</span><b>{distribution?.p90_completed_run_usd ? usd(distribution.p90_completed_run_usd) : "Unavailable"}</b></div><p className="small">Run distribution excludes {distribution?.completed_runs_with_unknown_cost ?? 0} completed runs with unknown cost. The effective per-outcome figure above includes costs from failed runs.</p></section>
      <section className="card"><h2>Period-end estimate</h2>{projectedCost && row ? <><p>A simple known-cost run rate based on {elapsedDays} observed days. It is not adjusted for seasonality or future usage changes.</p><div className="metric" style={{boxShadow:"none"}}><span>Projected known direct cost</span><strong>{usd(projectedCost)}</strong><small>Compared with {usd(row.revenue_usd)} period revenue under current terms</small></div><p>{row.unknown_cost_events ? "Unpriced events make this estimate incomplete." : "Revisit as new usage arrives."}</p></> : <p>Choose a current period with at least three observed days to see a run-rate estimate. Historical periods show actuals above.</p>}</section></div>
    <section className="card section"><div className="section-heading"><div><h2>Cost by workflow</h2><p>Measured costs take priority over rate-card estimates.</p></div></div><div className="table-scroll"><table><thead><tr><th>Workflow</th><th>Model</th><th>Tool</th><th>Human review</th><th>Other</th><th>Unpriced events</th></tr></thead><tbody>{workflows.map((item) => <tr key={item.workflow_id}><td>{item.workflow_id}</td><td>{usd(item.model_cost_usd)}</td><td>{usd(item.tool_cost_usd)}</td><td>{usd(item.human_cost_usd)}</td><td>{usd(item.other_cost_usd)}</td><td>{item.unknown_cost_events}</td></tr>)}</tbody></table></div>{workflows.length === 0 && <p>No attributed workflow cost in this period.</p>}</section>
    <section className="card section"><h2>Daily cost & completed runs</h2><div className="trend-list">{daily.map((day) => { const amount = new Decimal(day.model_cost_usd).plus(day.direct_cost_usd); return <div className="trend-row" key={day.day}><span>{day.day}</span><div className="trend-track"><span style={{width:`${amount.div(highestDay).times(100).toNumber()}%`}}/></div><b>{usd(amount)}</b><small>{day.completed_outcomes} done{day.unknown_cost_events ? ` · ${day.unknown_cost_events} unknown` : ""}</small></div>; })}</div></section>
    <section className="card section"><div className="section-heading"><div><h2>Contract versions</h2><p>Past terms remain visible when a new effective version is saved.</p></div></div>{contracts.map((item) => <div className="row" key={item.id}><div><b>Version {item.version} · {item.billing_period}</b><div className="row-sub">{item.effective_from} to {item.effective_to ?? "current"} · Renewal {item.renewal_on ?? "not set"}</div></div><div>{usd(item.base_fee_usd)} base · {item.included_outcomes} included · {usd(item.overage_usd)} overage · {item.discount_pct}% discount</div></div>)}
      {canEdit && <><CustomerOwnerPicker orgId={orgId} customerId={customerId} selected={customer.owner_user_id} members={membersResult.data ?? []}/><details className="section"><summary className="table-link">Create an amended contract version</summary><div style={{marginTop:20}}><ContractEditor orgId={orgId} initial={{customerId:customer.external_id,customerName:customer.name,billingPeriod:newest?.billing_period ?? "monthly",baseFeeUsd:String(newest?.base_fee_usd ?? "0"),includedOutcomes:newest?.included_outcomes ?? 0,overageUsd:String(newest?.overage_usd ?? "0"),discountPct:String(newest?.discount_pct ?? "0"),targetMarginPct:newest?.target_margin_pct ?? null,renewalOn:newest?.renewal_on ?? null}}/></div></details></>}
    </section>
    <section className="card section" id="sources"><h2>Source records</h2><p>IDs, timestamps, model, tokens, and cost basis provide the audit trail. Prompt and response content are not stored.</p><div className="table-scroll"><table><thead><tr><th>Event / source</th><th>Time</th><th>Workflow / run</th><th>Model</th><th>Cost</th></tr></thead><tbody>{sources.map((item) => <tr key={item.event_id}><td>{item.source_event_id}<small>{item.source}</small></td><td>{new Date(item.occurred_at).toLocaleString()}</td><td>{item.workflow_id}<small>{item.run_id}</small></td><td>{item.provider} · {item.model}<small>{item.input_tokens} in · {item.output_tokens} out</small></td><td>{item.cost_usd ? usd(item.cost_usd) : "Unknown"}<small>{item.cost_basis}</small></td></tr>)}</tbody></table></div>{sources.length === 0 && <p>No usage records in this period.</p>}{sources.length === 100 && <Link className="button secondary" href={`${base}?from=${period.from}&to=${period.to}&before=${sources.at(-1)?.event_id}#sources`}>Older records</Link>}</section>
  </main>;
}
