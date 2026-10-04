import Link from "next/link";

export default function PricingPage(){return <main className="frame page public-copy"><span className="eyebrow">Transparent pricing</span>
  <h1>One plan for the contract-margin workflow</h1><p>Start with a 14-day trial. Choose a subscription when your team is ready to keep importing and making decisions.</p>
  <div className="grid"><section className="card"><h2>Monthly</h2><p className="price">$1,500 <small>/ month</small></p>
    <p>Billed monthly in USD, plus applicable tax.</p><Link className="button" href="/sign-in?mode=signup">Start trial</Link></section>
    <section className="card"><h2>Annual</h2><p className="price">$15,000 <small>/ year</small></p>
      <p>Billed annually in USD, plus applicable tax.</p><Link className="button" href="/sign-in?mode=signup">Start trial</Link></section></div>
  <section className="card section"><h2>Included with either interval</h2><ul>
    <li>Two direct supplier connections: OpenAI and Anthropic organization cost APIs.</li>
    <li>Up to two million normalized usage, outcome, and direct-cost events per calendar month.</li>
    <li>Versioned contracts, quote decisions, margin issues, email alerts, weekly digests, and PDF/CSV month-end packets.</li>
    <li>Owner, Finance, Engineer, and Viewer roles with administrative MFA.</li></ul>
    <p>At 80% of the monthly event allowance, the workspace warns the Owner. Ingestion beyond two million stops with an explicit error; accepted records stay available. The trial includes one frozen historical audit and one saved scenario. Trial expiry makes data read-only until subscription activation. Cancel through the Stripe-hosted portal; access follows the paid period and verified subscription state.</p>
  </section><p className="section small">This is list pricing for the standard product. Supplier API charges, taxes, and any custom services are separate. Solvren makes no guaranteed margin or savings claim.</p>
  </main>}
