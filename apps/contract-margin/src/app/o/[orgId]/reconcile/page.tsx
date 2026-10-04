import Link from "next/link";
import Decimal from "decimal.js";
import { redirect } from "next/navigation";
import { organizationAccess } from "@/lib/auth";
import { dateRange, usd } from "@/lib/finance";
import { ContractEditor } from "@/components/ContractEditor";
import { ConnectionConsole } from "./ConnectionConsole";
import { StripeMappingForm } from "./StripeMappingForm";
import { DataLifecycle } from "./DataLifecycle";
import { serverNowMs } from "@/lib/server-time";

type Search = { from?: string; to?: string; draft?: string; frozen?: string; error?: string };
type Reconciliation = { provider: string; source: string; reported_usd: string | null;
  attributed_usd: string; variance_usd: string | null; unassigned_usd: string | null;
  covered_days: number; total_days: number; unmapped_events: number; unpriced_events: number;
  scope_missing_events: number; status: string; last_success_at: string | null; last_error: string | null };
type StripeSubscription = { stripe_subscription_id: string; stripe_customer_id: string;
  status: string; currency: string; interval: string | null; interval_count: number | null;
  gross_recurring_usd: string | null; discount_note: string | null };

export default async function ReconcilePage({ params, searchParams }: {
  params: Promise<{ orgId: string }>; searchParams: Promise<Search>;
}) {
  const { orgId } = await params;
  const search = await searchParams;
  const period = dateRange(search);
  const { supabase, role } = await organizationAccess(orgId);
  if (!period) redirect(`/o/${orgId}/reconcile`);
  const [orgResult, connectionsResult, jobsResult, reconciliationResult,
    stripeJobResult, customersResult, mappingsResult, snapshotsResult] = await Promise.all([
    supabase.from("organizations").select("name").eq("id", orgId).single(),
    supabase.from("provider_connections").select("provider,connected_at,disconnected_at,last_success_at,last_error,synced_through")
      .eq("org_id", orgId),
    supabase.from("connector_jobs").select("id,provider,day,status,attempts,last_error,requested_at,completed_at,rows_seen")
      .eq("org_id", orgId).order("requested_at", { ascending: false }).limit(40),
    supabase.rpc("phase2_reconciliation", { p_org: orgId, p_start: period.from, p_end: period.to }),
    supabase.from("connector_jobs").select("id").eq("org_id", orgId).eq("provider", "stripe")
      .eq("status", "completed").order("completed_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("customers").select("id,name,external_id").eq("org_id", orgId).order("name").limit(1000),
    supabase.from("customer_mappings").select("source_customer_id,customer_id").eq("org_id", orgId).eq("source", "stripe").limit(1000),
    supabase.from("report_snapshots").select("id,version,period_start,period_end,confidence,status,created_at,frozen_at")
      .eq("org_id", orgId).order("created_at", { ascending: false }).limit(30),
  ]);
  if (!orgResult.data) redirect("/workspace");
  if ([connectionsResult, jobsResult, reconciliationResult, stripeJobResult,
    customersResult, mappingsResult, snapshotsResult].some((result) => result.error))
    return <main className="frame page"><h1>Reconciliation unavailable</h1><p>Try again after checking your connection status.</p><Link className="button" href={`/o/${orgId}`}>Portfolio</Link></main>;
  const stripeJobId = stripeJobResult.data?.id;
  const [stripeCustomersResult, subscriptionsResult, invoicesResult] = stripeJobId ? await Promise.all([
    supabase.from("stripe_customers").select("stripe_customer_id,display_name,email")
      .eq("org_id", orgId).eq("last_seen_job", stripeJobId).order("stripe_customer_id").limit(1000),
    supabase.from("stripe_subscriptions").select("stripe_subscription_id,stripe_customer_id,status,currency,interval,interval_count,gross_recurring_usd,discount_note")
      .eq("org_id", orgId).eq("last_seen_job", stripeJobId).order("stripe_customer_id").limit(1000),
    supabase.from("stripe_invoices").select("stripe_customer_id,currency,subtotal_usd,discount_usd,credit_usd,total_usd")
      .eq("org_id", orgId).eq("last_seen_job", stripeJobId).limit(1000),
  ]) : [{ data: [], error: null }, { data: [], error: null }, { data: [], error: null }];
  if (stripeCustomersResult.error || subscriptionsResult.error || invoicesResult.error)
    return <main className="frame page"><h1>Stripe evidence unavailable</h1><Link className="button" href={`/o/${orgId}`}>Portfolio</Link></main>;
  const reconciliations = (reconciliationResult.data ?? []) as Reconciliation[];
  const customers = customersResult.data ?? [];
  const stripeCustomers = stripeCustomersResult.data ?? [];
  const subscriptions = (subscriptionsResult.data ?? []) as StripeSubscription[];
  const invoices = invoicesResult.data ?? [];
  const mapping = new Map((mappingsResult.data ?? []).map((item) => [item.source_customer_id, item.customer_id]));
  const draft = subscriptions.find((item) => item.stripe_subscription_id === search.draft);
  const mappedDraft = draft ? customers.find((item) => item.id === mapping.get(draft.stripe_customer_id)) : null;
  const draftCustomer = draft ? stripeCustomers.find((item) => item.stripe_customer_id === draft.stripe_customer_id) : null;
  const canDraft = draft && draft.currency === "USD" && draft.gross_recurring_usd
    && draft.interval_count === 1 && ["month", "year"].includes(draft.interval ?? "");
  const finance = role === "owner" || role === "finance";
  const nowMs = serverNowMs();
  return <main className="frame page"><Link className="button ghost" href={`/o/${orgId}`}>← Portfolio</Link>
    <div className="intro"><span className="eyebrow">{orgResult.data.name}</span><h1 style={{marginTop:18}}>Reconcile & freeze</h1><p>Compare customer-attributed model spend with supplier-reported totals. Leave unexplained dollars visible, then freeze a month-end packet.</p></div>
    {search.frozen && <p className="message" role="status">Report frozen. Its PDF and CSV are available below.</p>}
    {search.error && <p className="message error" role="alert">Report freeze failed. Review source health and retry.</p>}
    <form className="card report-filters" method="get"><label className="field">From<input className="input" type="date" name="from" defaultValue={period.from} required/></label><label className="field">To, exclusive<input className="input" type="date" name="to" defaultValue={period.to} required/></label><button className="button">Review period</button></form>
    <section className="card section"><h2>Supplier reconciliation</h2><p>Provider totals are never spread across customers. A positive variance is reported but unattributed spend; a negative variance means attributed usage exceeds the supplier source.</p><div className="table-scroll"><table><thead><tr><th>Provider</th><th>Evidence</th><th>Reported</th><th>Attributed</th><th>Unassigned</th><th>Variance</th><th>Coverage</th><th>Status</th></tr></thead><tbody>{reconciliations.map((item) => <tr key={item.provider}><td>{item.provider}</td><td>{item.source}</td><td>{item.reported_usd === null ? "Unavailable" : usd(item.reported_usd)}</td><td>{usd(item.attributed_usd)}</td><td>{item.unassigned_usd === null ? "Unavailable" : usd(item.unassigned_usd)}</td><td>{item.variance_usd === null ? "Unavailable" : usd(item.variance_usd)}</td><td>{item.covered_days}/{item.total_days} days<small>{item.unmapped_events} unmapped · {item.unpriced_events} unpriced · {item.scope_missing_events} without project/workspace ID</small></td><td><span className={`pill ${["variance","partial","stale"].includes(item.status) ? "risk" : ""}`}>{item.status}</span>{item.last_error && <small>{item.last_error}</small>}</td></tr>)}</tbody></table></div><p className="small">“Verified” requires full period coverage, priced and mapped direct usage, project/workspace IDs where available, fresh connector data, and variance within 5% or $0.01. Supplier totals may include non-inference line items. Anthropic Priority Tier and cloud reseller charges are not reported by this Admin API; use statements where applicable.</p></section>
    <ConnectionConsole orgId={orgId} role={role} nowMs={nowMs} connections={connectionsResult.data ?? []}/>
    <section className="card section"><h2>Sync activity</h2><p>Initial backfill covers 30 completed days. Daily refresh replays the last three completed days to capture late supplier adjustments. Failed jobs remain visible until retried.</p><div className="table-scroll"><table><thead><tr><th>Provider / day</th><th>State</th><th>Requested</th><th>Detail</th></tr></thead><tbody>{(jobsResult.data ?? []).map((job) => <tr key={job.id}><td>{job.provider} · {job.day ?? "revenue catalog"}</td><td><span className="pill">{job.status}</span></td><td>{new Date(job.requested_at).toLocaleString()}</td><td>{job.last_error ?? (job.status === "completed" ? "Source captured" : "In progress")}</td></tr>)}</tbody></table></div></section>
    {stripeJobId && <section className="card section"><h2>Stripe revenue evidence</h2><p>Stripe is a read-only suggestion. Subscription list price can differ from signed contract value; discounts, credit notes, and metered items need Finance review. No contract changes until Finance saves an effective version.</p>
      {stripeCustomers.length === 0 ? <p>No Stripe customers were returned.</p> : stripeCustomers.map((customer) => {
        const subs = subscriptions.filter((item) => item.stripe_customer_id === customer.stripe_customer_id);
        const bills = invoices.filter((item) => item.stripe_customer_id === customer.stripe_customer_id);
        const usdBills = bills.filter((item) => item.currency === "USD");
        const discounts = usdBills.reduce((sum, item) => sum.plus(item.discount_usd ?? 0), new Decimal(0));
        const credits = usdBills.reduce((sum, item) => sum.plus(item.credit_usd ?? 0), new Decimal(0));
        const otherCurrencyCount = bills.length - usdBills.length;
        return <div className="row" key={customer.stripe_customer_id}><div><b>{customer.display_name ?? customer.stripe_customer_id}</b><div className="row-sub">{customer.stripe_customer_id} · {customer.email ?? "email not supplied"} · {bills.length} invoices · {usd(discounts)} USD discounts · {usd(credits)} USD credit notes{otherCurrencyCount > 0 ? ` · ${otherCurrencyCount} non-USD invoices require review` : ""}</div>{subs.map((sub) => <div className="row-sub" key={sub.stripe_subscription_id}>{sub.status} · {sub.currency} {sub.gross_recurring_usd ? usd(sub.gross_recurring_usd) : "price needs review"} / {sub.interval ?? "unknown period"} · {sub.discount_note ?? "No subscription discount flag"} {finance && <Link className="table-link" href={`?from=${period.from}&to=${period.to}&draft=${sub.stripe_subscription_id}#stripe-draft`}>Review draft →</Link>}</div>)}{finance && <StripeMappingForm orgId={orgId} stripeCustomerId={customer.stripe_customer_id} customers={customers} selected={mapping.get(customer.stripe_customer_id)}/>}</div></div>;
      })}
      {finance && draft && <div id="stripe-draft" className="section"><h3>Review {draft.stripe_subscription_id}</h3><p>{canDraft ? "This prefilled gross price excludes contractual overrides. Confirm the signed terms, discounts, included outcomes, and effective date before saving." : "This subscription has non-USD, metered, mixed, or unsupported recurring terms. Enter confirmed USD contract terms manually in Data & imports."}</p>{canDraft && <ContractEditor key={draft.stripe_subscription_id} orgId={orgId} initial={{ customerId: mappedDraft?.external_id ?? draft.stripe_customer_id,
        customerName: mappedDraft?.name ?? draftCustomer?.display_name ?? draft.stripe_customer_id,
        billingPeriod: draft.interval === "year" ? "annual" : "monthly",
        baseFeeUsd: draft.gross_recurring_usd!, includedOutcomes: 0, overageUsd: "0",
        discountPct: "0", targetMarginPct: null, renewalOn: null }}/>}</div>}
    </section>}
    <section className="card section"><h2>Frozen reports</h2><p>A frozen packet keeps the terms, mappings, supplier evidence, definitions, and exception state from the moment of approval. Later edits create a new version.</p>{(snapshotsResult.data ?? []).length === 0 ? <p>No frozen packets yet.</p> : (snapshotsResult.data ?? []).map((snapshot) => <div className="row" key={snapshot.id}><div><b>{snapshot.period_start} to {snapshot.period_end} · version {snapshot.version}</b><div className="row-sub">{snapshot.confidence} · {snapshot.status} · {new Date(snapshot.created_at).toLocaleString()}</div></div>{snapshot.status === "frozen" && <div className="inline-form"><a className="button secondary" href={`/api/organizations/${orgId}/reports/${snapshot.id}/download?format=pdf`}>PDF</a><a className="button secondary" href={`/api/organizations/${orgId}/reports/${snapshot.id}/download?format=csv`}>CSV</a></div>}</div>)}{finance && <form method="post" action={`/api/organizations/${orgId}/reports`}><input type="hidden" name="from" value={period.from}/><input type="hidden" name="to" value={period.to}/><button className="button" type="submit">Freeze this period</button></form>}</section>
    <DataLifecycle orgId={orgId} owner={role === "owner"}/>
  </main>;
}
