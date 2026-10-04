import { PasswordReset } from "./PasswordReset";

export default function PasswordResetPage() {
  return <main className="frame page"><div className="card" style={{maxWidth:560,margin:"30px auto"}}><span className="eyebrow">Account recovery</span><h1 style={{marginTop:18}}>Reset your password</h1><p>Enter your account email. If it exists, we’ll send a private reset link.</p><PasswordReset/></div></main>;
}
