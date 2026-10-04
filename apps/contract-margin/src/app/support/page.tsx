import { SupportForm } from "./SupportForm";

export default async function SupportPage({searchParams}:{searchParams:Promise<{org?:string}>}){
  const {org}=await searchParams;
  const orgId=org&&/^[0-9a-f-]{36}$/i.test(org)?org:null;
  return <main className="frame page public-copy"><span className="eyebrow">Help and contact</span>
    <h1>Reach the Solvren team</h1><p>Use the form for product questions, integration repair, billing, security reports, or deletion requests. Every accepted request receives a case ID.</p>
    <div className="grid"><div><SupportForm orgId={orgId}/></div><aside className="card">
      <h2>Response targets</h2><p>Urgent billing and security cases: first response within 24 hours. Product, integration, and deletion cases: first response within 48 hours. Times are measured from ticket creation; resolution depends on the issue.</p>
      <h3>Integration repair</h3><p>Check the connection’s last successful sync, credential scope, provider account type, supplier-day coverage, and unresolved mapping IDs. A failed sync never makes an old snapshot current.</p>
      <h3>Security</h3><p>Choose “Security report” in the form. Include the affected URL and a safe description; do not send exploit payloads, customer financial files, or secrets.</p>
      <h3>Deletion</h3><p>An Owner can request account closure inside the workspace with a fresh authenticator code. The support form handles questions about that process.</p>
    </aside></div></main>;
}
