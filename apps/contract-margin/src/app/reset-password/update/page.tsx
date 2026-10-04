import { NewPassword } from "./NewPassword";

export default function NewPasswordPage() {
  return <main className="frame page"><div className="card" style={{maxWidth:560,margin:"30px auto"}}><span className="eyebrow">Account recovery</span><h1 style={{marginTop:18}}>Choose a new password</h1><p>Use at least 12 characters.</p><NewPassword/></div></main>;
}
