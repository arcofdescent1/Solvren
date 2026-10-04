import { AuthForm } from "./AuthForm";
import { safeNext } from "@/lib/safe-next";

export default async function SignInPage({ searchParams }: {
  searchParams: Promise<{ next?: string; error?: string;mode?:string }>;
}) {
  const params = await searchParams;
  const next = safeNext(params.next);
  return <main className="auth-wrap">
    <aside className="auth-art">
      <div className="brand"><span className="brand-mark">S</span>Solvren</div>
      <div><span className="eyebrow">The finance view for AI</span><h1 style={{marginTop:24}}>Clarity starts with a secure workspace.</h1>
        <p>Bring finance and engineering together around the numbers that matter, with precise access for every teammate.</p></div>
      <span className="small" style={{color:"#91b5ac"}}>Built for careful decisions.</span>
    </aside>
    <section className="auth-panel"><div className="auth-panel-inner"><AuthForm next={next} initialMode={params.mode==="signup"?"up":"in"} initialError={params.error ? "Sign-in could not be completed. Please try again." : undefined}/></div></section>
  </main>;
}
