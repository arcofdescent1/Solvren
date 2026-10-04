import Link from "next/link";
import { ResendVerification } from "./ResendVerification";

export default function VerifyEmail() {
  return <main className="frame page"><div className="card" style={{maxWidth:570,margin:"30px auto"}}>
    <span className="eyebrow">One more step</span><h1 style={{marginTop:18}}>Check your inbox</h1>
    <p>We sent a verification link to your email address. Open it to activate your account, then return to Solvren.</p>
    <ResendVerification/>
    <Link href="/sign-in" className="button">Back to sign in</Link>
  </div></main>;
}
