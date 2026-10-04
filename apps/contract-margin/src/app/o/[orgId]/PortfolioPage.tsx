import Link from "next/link";
import Decimal from "decimal.js";
import { redirect } from "next/navigation";
import { organizationAccess } from "@/lib/auth";
import { contribution, contributionRate, dateRange, exposure, PortfolioRow, riskStatus, usd } from "@/lib/finance";
import { SignOutButton } from "@/components/SignOutButton";

type Search = { from?: string; to?: string; workflow?: string; owner?: string; risk?: string; confidence?: string };
type Coverage = { provider: string; direct_cost_usd: string; statement_usd: string | null; statement_days: number | null;
  unmapped_events: number; unpriced_events: number; last_usage_at: string | null };
type Mapping = { source: string; source_customer_id: string; event_count: number; known_cost_usd: string };

export default async function PortfolioPage({ params, searchParams }: {
  params: Promise<{ orgId: string }>; searchParams: Promise<Search>;
}) {
  const { orgId } = await params;
  const search = await searchParams;
  const { supabase, user, role } = await organizationAccess(orgId);
  const period = dateRange(search);
  if (!period) return <main className="frame page"><h1>Choose a valid period</h1><p>Reports cover 1 to 62 days.</p><Link className="button" href={`/o/${orgId}`}>Use the last 30 days</Link></main>;
  const [{ data: org }, rowsResult, coverageResult, unmappedResult, workflowsResult] = await Promise.all([
    supabase.from("organizations").select("name").eq("id", orgId).single(),
    supabase.rpc("phase1_portfolio", { p_org: orgId, p_start: period.from, p_end: period.to }),
    supabase.rpc("phase1_source_coverage", { p_org: orgId, p_start: period.from, p_end: period.to }),
    supabase.rpc("phase1_unmapped", { p_org: orgId, p_start: period.from, p_end: period.to }),
    supabase.rpc("phase1_customer_workflows", { p_org: orgId, p_start: period.from, p_end: period.to }),
  ]);
  if (!org) redirect("/workspace");
  if (rowsResult.error || coverageResult.error || unmappedResult.error || workflowsResult.error)
    return <main className="frame page"><h1>Report unavailable</h1><p>The financial records could not be read. Please try again or check your imports.</p><Link className="button secondary" href={`/o/${orgId}/data`}>Check imports</Link></main>;
  const rows = (rowsResult.data ?? []) as PortfolioRow[];
  const coverage = (coverageResult.data ?? []) as Coverage[];
  const unmapped = (unmappedResult.data ?? []) as Mapping[];
  const links = (workflowsResult.data ?? []) as Array<{ customer_id: string; workflow_id: string }>;
  const owners = [...new Set(rows.map((row) => row.owner_email).filter(Boolean))] as string[];
  const workflows = [...new Set(links.map((item) => item.workflow_id))].sort();
  const revenue = rows.reduce((sum, row) => sum.plus(row.revenue_usd), new Decimal(0));
  const cost = rows.reduce((sum, row) => sum.plus(row.known_cost_usd), new Decimal(0));
  const exposed = rows.reduce((sum, row) => sum.plus(exposure(row)), new Decimal(0));
  const atRisk = rows.filter((row) => riskStatus(row) === "Below floor").length;
  const unknown = rows.reduce((sum, row) => sum + Number(row.unknown_cost_events), 0);
  const unmappedEvents = unmapped.reduce((sum, row) => sum + Number(row.event_count), 0);
  const freshness = coverage.map((row) => row.last_usage_at).filter(Boolean).sort().at(-1);
  const directProviders = coverage.filter((row) => new Decimal(row.direct_cost_usd).gt(0));
  const reconciled = directProviders.length > 0 && directProviders.every((row) => row.statement_usd !== null
    && Number(row.statement_days) === period.days
    && new Decimal(row.statement_usd).minus(row.direct_cost_usd).abs()
      .lte(Decimal.max(new Decimal(row.statement_usd).times("0.05"), "0.01")));
  const confidence = unknown || unmappedEvents ? "Partial" : reconciled ? "Statement-matched" : "Provisional";
  const matching = rows.filter((row) =>
    (!search.workflow || links.some((link) => link.customer_id === row.customer_id && link.workflow_id === search.workflow))
    && (!search.owner || row.owner_email === search.owner)
    && (!search.risk || riskStatus(row) === search.risk)
    && (!search.confidence || (row.unknown_cost_events ? "Partial"
      : reconciled && !unmappedEvents ? "Statement-matched" : "Provisional") === search.confidence));
  matching.sort((a, b) => exposure(b).comparedTo(exposure(a)) || a.customer_name.localeCompare(b.customer_name));
  const drivers = [...rows].sort((a, b) => new Decimal(b.known_cost_usd).comparedTo(a.known_cost_usd)).slice(0, 3);
  const base = `/o/${orgId}`;
  return <main className="frame page">
    <div className="toolbar" style={{marginTop:0}}><span className="eyebrow">Contract margin control</span><div className="top-links"><span>{user.email}</span><SignOutButton/></div></div>
    <div className="toolbar dashboard-heading"><div><h1>{org.name}</h1><p>See which customer contract needs a decision, and trace every figure to its source.</p></div><span className="pill">{role}</span></div>
    <nav className="workspace-nav" aria-label="Workspace"><Link aria-current="page" href={base}>Portfolio</Link><Link href={`${base}/data`}>Data & imports</Link><Link href={`${base}/reconcile`}>Reconcile & reports</Link>{role === "owner" && <Link href={`${base}/team`}>People & access</Link>}<Link href="/mfa">Account security</Link></nav>
    <form className="card report-filters" method="get"><div className="field"><label htmlFor="from">From, inclusive</label><input className="input" id="from" type="date" name="from" defaultValue={period.from} required/></div><div className="field"><label htmlFor="to">To, exclusive</label><input className="input" id="to" type="date" name="to" defaultValue={period.to} required/></div><button className="button">Update report</button></form>
    {rows.length === 0 ? <section className="card section"><h2>{unmappedEvents ? "Map usage to a contract" : "Your first margin audit starts with data"}</h2><p>{unmappedEvents ? `${unmappedEvents} imported events have no customer mapping. Import the matching contracts or resolve IDs before reviewing margin.` : "Import a contract file, usage events, and completed outcomes. Supplier statements strengthen the comparison."}</p><Link className="button" href={`${base}/data`}>Set up data →</Link></section> : <>
      <div className="metric-grid section"><div className="metric"><span>Contract revenue</span><strong>{usd(revenue)}</strong><small>{period.days} days · effective terms</small></div><div className="metric"><span>Known direct cost</span><strong>{usd(cost)}</strong><small>Mapped, priced model and delivery cost</small></div><div className="metric"><span>Contribution upper bound</span><strong>{usd(revenue.minus(cost))}</strong><small>{unknown || unmappedEvents ? `${unknown} unpriced · ${unmappedEvents} unmapped events excluded` : "All imported events attributed and priced"}</small></div><div className="metric"><span>Below margin floor</span><strong>{atRisk} contracts</strong><small>{usd(exposed)} known exposure</small></div></div>
      <div className="grid section"><section className="card"><div className="card-head"><h2>Evidence & confidence</h2><span className="pill">{confidence}</span></div><p>{unmappedEvents} unmapped events · {unknown} unpriced events. Latest usage: {freshness ? new Date(freshness).toLocaleString() : "none in period"}.</p>{coverage.map((item) => <div className="row" key={item.provider}><div><b>{item.provider}</b><div className="row-sub">Attributed direct cost {usd(item.direct_cost_usd)}</div></div><span className="row-sub">Statement {item.statement_usd === null ? "not supplied" : usd(item.statement_usd)}{item.statement_usd !== null && <small>{item.statement_days}/{period.days} days · Difference {usd(new Decimal(item.statement_usd).minus(item.direct_cost_usd))}</small>}</span></div>)}<Link className="button ghost" href={`${base}/data#mapping`}>Review source gaps →</Link></section><section className="card"><h2>Largest cost drivers</h2><p>Accounts with the highest known direct cost.</p>{drivers.map((row) => <div className="row" key={row.customer_id}><div><Link className="row-title" href={`${base}/customers/${row.customer_id}?from=${period.from}&to=${period.to}`}>{row.customer_name}</Link><div className="row-sub">{row.top_workflow ?? "Workflow not identified"}</div></div><b>{usd(row.known_cost_usd)}</b></div>)}</section></div>
      <section className="card section"><div className="section-heading"><div><h2>Contract decisions</h2><p>Ranked by known dollars above the margin floor. Incomplete costs remain marked.</p></div><span className="pill">{matching.length} of {rows.length}</span></div>
        <form className="queue-filters" method="get"><input type="hidden" name="from" value={period.from}/><input type="hidden" name="to" value={period.to}/><label>Workflow<select className="select" name="workflow" defaultValue={search.workflow ?? ""}><option value="">All</option>{workflows.map((name) => <option key={name}>{name}</option>)}</select></label><label>Owner<select className="select" name="owner" defaultValue={search.owner ?? ""}><option value="">All</option>{owners.map((name) => <option key={name}>{name}</option>)}</select></label><label>Risk<select className="select" name="risk" defaultValue={search.risk ?? ""}><option value="">All</option>{["Below floor", "Cost incomplete", "Above floor", "No activity"].map((name) => <option key={name}>{name}</option>)}</select></label><label>Confidence<select className="select" name="confidence" defaultValue={search.confidence ?? ""}><option value="">All</option><option>Partial</option><option>Provisional</option><option>Statement-matched</option></select></label><button className="button secondary">Filter</button></form>
        <div className="table-scroll"><table><thead><tr><th>Customer</th><th>Observed state</th><th>Revenue</th><th>Known cost</th><th>Contribution</th><th>Exposure</th><th>Owner / next decision</th></tr></thead><tbody>{matching.map((row) => <tr key={row.customer_id}><td><Link className="table-link" href={`${base}/customers/${row.customer_id}?from=${period.from}&to=${period.to}`}>{row.customer_name} ↗</Link><small>{row.customer_external_id}</small></td><td><span className={`pill ${riskStatus(row) === "Below floor" ? "risk" : ""}`}>{riskStatus(row)}</span>{row.unknown_cost_events > 0 && <small>{row.unknown_cost_events} costs unknown</small>}</td><td>{usd(row.revenue_usd)}</td><td>{usd(row.known_cost_usd)}</td><td>{usd(contribution(row))}<small>{contributionRate(row)?.toDecimalPlaces(1).toString() ?? "n/a"}% upper bound</small></td><td>{usd(exposure(row))}</td><td>{row.owner_email ?? "Unassigned"}<small>{row.renewal_on ? `Renewal ${row.renewal_on}` : "No renewal date"}</small></td></tr>)}</tbody></table></div>{matching.length === 0 && <p>No contracts match these filters.</p>}
      </section>
    </>}
    <p className="section small">Report values are management estimates, not GAAP revenue recognition. Unknown costs cannot be assumed zero.</p>
  </main>;
}
