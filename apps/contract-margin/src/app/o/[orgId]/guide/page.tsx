import Link from "next/link";
import { organizationAccess } from "@/lib/auth";

export default async function GuidePage({params}:{params:Promise<{orgId:string}>}){
  const {orgId}=await params;
  await organizationAccess(orgId);
  return <main className="frame page public-copy"><Link className="button ghost" href={`/o/${orgId}/start`}>← Getting started</Link>
    <div className="intro"><span className="eyebrow">Product guide</span><h1 style={{marginTop:18}}>Fields, formulas, and source repair</h1>
      <p>Use these definitions to check the result before making a contract decision.</p></div>
    <section className="card"><h2>Import fields</h2><p><b>Source</b> names the application or export. <b>Source event ID</b> is stable across retries and prevents duplicates. <b>Customer ID</b> maps an event to a signed customer contract. <b>Workflow ID</b> groups AI work of the same kind. <b>Run ID</b> joins usage and direct cost to the completed outcome. <b>Occurred at</b> is an ISO timestamp, not import time. <b>Status</b> distinguishes completed work from failures. Model and token buckets support rate-card pricing when measured cost is absent.</p>
      <p>Download the five example CSV templates in <Link className="table-link" href={`/o/${orgId}/data`}>Data & imports</Link>. A file with invalid financial rows is rejected as a whole; event imports identify invalid row numbers. Prompt or response content is not a supported field.</p></section>
    <section className="card section"><h2>Margin formulas</h2><p>Period revenue comes from the effective signed contract base fee, discount, allowance, and overage terms. Known direct cost includes attributed priced model usage plus mapped tool, human-review, and other direct cost. Known contribution equals contract revenue minus known direct cost. Contribution rate divides known contribution by revenue when revenue is positive.</p>
      <p>When events are unpriced or unmapped, known contribution is an <b>upper bound</b>; it is not an exact gross margin. Exposure is the known cost above the amount allowed by the contract’s target contribution margin. Quote adverse cost uses the observed p90 completed-run unit cost and an explicit volume stress assumption. Fewer than 30 priced completed runs require manual unit-cost assumptions. A period-end estimate extends observed month-to-date cost using a trailing run rate and is labeled sparse when coverage is insufficient.</p></section>
    <section className="card section"><h2>Repair a source</h2><ol><li>Open <Link className="table-link" href={`/o/${orgId}/reconcile`}>Reconcile & reports</Link> to inspect connection health, last successful day, provider scope, and statement variance.</li>
      <li>Verify that a provider credential has organization-admin read access and matches its billing route; reconnect with a fresh authenticator code if needed.</li>
      <li>Map unmatched source customer IDs in <Link className="table-link" href={`/o/${orgId}/data`}>Data & imports</Link> and add effective-dated rates for unknown models.</li>
      <li>Retry the failed import or source sync with the same stable event IDs. Check rejected rows and supplier-day coverage before freezing a report.</li></ol>
      <p>Cloud-reseller and unsupported supplier billing requires a supplied statement. Do not treat an absent supplier day as zero.</p></section>
    <p className="section">Need help? <Link className="table-link" href={`/support?org=${orgId}`}>Open a tracked support case</Link>.</p></main>;
}
