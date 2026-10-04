"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { browserSupabase } from "@/lib/supabase/browser";

type Factor = { id: string };
type Enrollment = { id: string; qr: string; secret: string };

export function MfaPanel({ next }: { next: string }) {
  const router = useRouter();
  const [factor,setFactor] = useState<Factor|null>(null);
  const [enrollment,setEnrollment] = useState<Enrollment|null>(null);
  const [code,setCode] = useState("");
  const [status,setStatus] = useState<"loading"|"setup"|"verify"|"ready">("loading");
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState("");
  useEffect(()=>{
    let active=true;
    const client=browserSupabase();
    Promise.all([client.auth.mfa.getAuthenticatorAssuranceLevel(),client.auth.mfa.listFactors()]).then(([level,factors])=>{
      if(!active)return;
      if(level.data?.currentLevel==="aal2")setStatus("ready");
      else if(factors.data?.totp.length){setFactor(factors.data.totp[0]);setStatus("verify");}
      else setStatus("setup");
    }).catch(()=>active&&setError("Could not load account security. Refresh and try again."));
    return ()=>{active=false};
  },[]);
  async function enroll() {
    setBusy(true);setError("");
    const {data,error}=await browserSupabase().auth.mfa.enroll({factorType:"totp",friendlyName:"Solvren"});
    setBusy(false);
    if(error||!data?.totp){setError(error?.message??"Could not start authenticator setup.");return;}
    setEnrollment({id:data.id,qr:data.totp.qr_code,secret:data.totp.secret});
  }
  async function verify(e:React.FormEvent) {
    e.preventDefault();setBusy(true);setError("");
    const id=enrollment?.id??factor?.id;
    if(!id){setError("Authenticator setup is missing.");setBusy(false);return;}
    const {error}=await browserSupabase().auth.mfa.challengeAndVerify({factorId:id,code});
    setBusy(false);
    if(error){setError("That code was not accepted. Check the time on your device and try again.");return;}
    setStatus("ready");router.push(next);router.refresh();
  }
  async function signOutEverywhere() {
    setBusy(true);setError("");
    const {error}=await browserSupabase().auth.signOut({scope:"global"});
    setBusy(false);
    if(error){setError("Could not sign out all devices. Please try again.");return;}
    router.push("/sign-in");router.refresh();
  }
  if(status==="loading")return <p>Checking account security…</p>;
  if(status==="ready")return <><h2>Your account is protected</h2><p>Your authenticator is active for this session.</p><div className="inline-form"><button className="button" onClick={()=>router.push(next)}>Continue</button><button className="button secondary" disabled={busy} onClick={signOutEverywhere}>{busy?"Signing out…":"Sign out all devices"}</button></div>{error&&<p className="message error" role="alert">{error}</p>}</>;
  return <><h2>{status==="setup"?"Set up an authenticator":"Enter your authenticator code"}</h2>
    <p>{status==="setup"?"Use an authenticator app such as Microsoft Authenticator or Google Authenticator.":"Open your authenticator app and enter the current code."}</p>
    {status==="setup"&&!enrollment&&<button className="button" disabled={busy} onClick={enroll}>{busy?"Preparing…":"Start setup"}</button>}
    {enrollment&&<div className="stack" style={{justifyItems:"start"}}><Image className="qr" src={enrollment.qr} alt="Authenticator setup QR code" width={210} height={210} unoptimized/><p className="small">If you cannot scan the code, enter this key in your authenticator app:</p><code className="code">{enrollment.secret}</code></div>}
    {(status==="verify"||enrollment)&&<form onSubmit={verify} style={{maxWidth:300,marginTop:24}}><div className="field"><label htmlFor="mfa-code">Six-digit code</label><input className="input code" id="mfa-code" type="text" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} autoComplete="one-time-code" value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,"").slice(0,6))} required/></div><button className="button full" disabled={busy}>{busy?"Checking…":"Verify and continue"}</button></form>}
    {error&&<p className="message error" role="alert" style={{marginTop:15}}>{error}</p>}
  </>;
}
