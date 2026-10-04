import Link from "next/link";
import { VisitTracker } from "./VisitTracker";

export default function Home(){
  return <main><VisitTracker/><section className="public-hero"><div className="frame hero-grid">
    <div><span className="eyebrow">AI contract margin control</span>
      <h1>Know what your AI contracts earn. Know what needs a decision.</h1>
      <p>Solvren joins signed customer terms to attributed AI delivery costs. Finance sees the evidence behind contribution, stress-tests proposed deals, and gets an issue when a contract crosses its margin floor.</p>
      <div className="inline-form"><Link className="button" href="/sign-in?mode=signup">Start a 14-day trial</Link>
        <Link className="button secondary" href="/sample-report">Explore a sample report</Link></div>
      <p className="small">No sales call required. One historical audit and one saved quote scenario in the trial.</p>
    </div><div className="hero-visual" aria-label="Illustrative contract margin dashboard">
      <div className="hero-visual-head"><span>CONTRACT REVIEW</span><span>Evidence first</span></div>
      <div className="hero-visual-figure"><small>Known contribution</small><strong>$42,840</strong>
        <span className="pill">Provisional · source coverage 94%</span></div>
      <div className="hero-mini"><span>Below floor</span><strong>3 contracts</strong></div>
      <div className="hero-mini"><span>Supplier reconciliation</span><strong>2 gaps need review</strong></div>
      <div className="hero-mini"><span>Next action</span><strong>Review price and allowance</strong></div>
      <p>Illustrative synthetic figures. No customer or savings claim.</p>
    </div></div></section>
    <section className="frame public-section"><div className="intro"><span className="eyebrow">From source to decision</span>
      <h2>One financial thread through the AI stack</h2><p>See what is known, what is missing, and which contract decision follows.</p></div>
      <div className="public-cards"><article className="card"><span className="card-icon">1</span><h3>Connect evidence</h3>
        <p>Import contract terms and metadata-only usage and outcomes. Connect OpenAI or Anthropic organization cost data and reconcile supplier totals.</p></article>
        <article className="card"><span className="card-icon">2</span><h3>Test the deal</h3>
        <p>Compare up to three proposals using observed median and upper-tail direct cost. Sparse samples require stated manual assumptions.</p></article>
        <article className="card"><span className="card-icon">3</span><h3>Operate the margin</h3>
        <p>Follow trailing run rates, assign issues, receive deduplicated email alerts, and freeze source-backed month-end packets.</p></article></div></section>
    <section className="public-band"><div className="frame grid"><div><span className="eyebrow">Clear boundaries</span>
      <h2>Built for finance-grade explanation</h2><p>Unknown cost is never treated as zero. Estimates and coverage gaps are labeled. Solvren suggests price and allowance changes but does not change customer billing, model routing, or access automatically.</p></div>
      <div className="card"><h3>Supported paths</h3><p>CSV and ingestion API for contracts and events; OpenAI and Anthropic organization-admin cost connections; Langfuse v4 observations; optional read-only Stripe revenue evidence.</p>
        <Link className="table-link" href="/integrations">Review integration scope →</Link></div></div></section>
    <section className="frame public-section"><div className="grid"><div><h2>Start with a real question</h2><p>Which contracts are already below the floor? Would the next proposal hold up if AI unit cost reaches the observed upper tail?</p></div>
      <div className="card"><h3>Simple commercial terms</h3><p>$1,500 per month or $15,000 per year, billed by Stripe. Includes two direct supplier connections and up to two million normalized events per month.</p>
        <Link className="button" href="/pricing">See pricing and limits</Link></div></div></section>
  </main>;
}
