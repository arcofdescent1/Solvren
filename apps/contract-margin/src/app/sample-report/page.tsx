import Link from "next/link";

export default function SampleReport(){return <main className="frame page public-copy"><span className="eyebrow">Synthetic example</span>
  <h1>What a contract-margin review shows</h1><p>Every figure on this page is illustrative synthetic data. It is not a customer result, audited supplier bill, or claimed savings.</p>
  <div className="metric-grid"><div className="metric"><span>Contract revenue</span><strong>$50,000</strong><small>Signed terms, 30-day period</small></div>
    <div className="metric"><span>Known direct cost</span><strong>$32,600</strong><small>Attributed and priced only</small></div>
    <div className="metric"><span>Known contribution</span><strong>$17,400</strong><small>34.8% upper bound</small></div>
    <div className="metric"><span>Confidence</span><strong>Partial</strong><small>6% of events unpriced</small></div></div>
  <section className="card section"><h2>Why it needs review</h2><p>The target floor is 40%. Known cost already puts this example below that floor. Six percent of usage events lack a valid model rate, so true direct cost may be higher and contribution lower. One supplier statement also differs from attributed direct usage by $1,250; Solvren displays the variance without assigning it to a customer.</p>
    <div className="row"><span>Observed contribution versus floor</span><strong>34.8% versus 40%</strong></div>
    <div className="row"><span>Unpriced usage</span><strong>6%</strong></div>
    <div className="row"><span>Supplier variance</span><strong>$1,250 unresolved</strong></div>
    <p>Next action: inspect the missing model rate and supplier scope, then review the contract’s price or included volume. No contract or billing change is automatic.</p></section>
  <Link className="button section" href="/sign-in?mode=signup">Try the workflow with your data</Link></main>}
