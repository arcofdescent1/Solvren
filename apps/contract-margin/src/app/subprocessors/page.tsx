export default function SubprocessorsPage(){return <main className="frame page public-copy"><span className="eyebrow">Trust materials</span>
  <h1>Service subprocessors</h1><p>Effective 4 October 2026. These providers support the configured Solvren application. The customer’s own OpenAI, Anthropic, Langfuse, and Stripe revenue accounts remain customer-directed integrations.</p>
  <div className="table-scroll card section"><table><thead><tr><th>Provider</th><th>Purpose</th><th>Data involved</th></tr></thead><tbody>
    <tr><td>Supabase</td><td>Authentication, PostgreSQL database, private files, encrypted connector secrets</td><td>Account, organization, contract, usage metadata, reports</td></tr>
    <tr><td>Vercel</td><td>Application hosting, HTTPS delivery, scheduled functions, runtime logs</td><td>Web requests and application responses</td></tr>
    <tr><td>Resend</td><td>Invitations, alerts, digests, and lifecycle email</td><td>Recipient email and limited aggregate message content</td></tr>
    <tr><td>Stripe</td><td>Solvren subscription checkout, invoices, billing portal, and payment processing</td><td>Billing contact, subscription and payment information</td></tr>
  </tbody></table></div><p className="section">Production service regions, backup retention, and transfer terms are confirmed in the customer’s executed agreement. We do not list an audit certification that has not been completed.</p></main>}
