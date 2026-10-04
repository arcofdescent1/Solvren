import { verifiedUser } from "@/lib/auth";
import { MfaPanel } from "./MfaPanel";
import { safeNext } from "@/lib/safe-next";

export default async function MfaPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  await verifiedUser();
  const params = await searchParams;
  const next = safeNext(params.next);
  return <main className="frame page"><div className="intro"><span className="eyebrow">Account security</span><h1 style={{marginTop:18}}>Protect your workspace</h1><p>Finance and engineering access requires an authenticator app. Your six-digit code adds a second check when you sign in.</p></div><div className="card" style={{maxWidth:650}}><MfaPanel next={next}/></div></main>;
}
