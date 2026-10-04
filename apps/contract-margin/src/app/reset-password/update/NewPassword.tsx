"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { browserSupabase } from "@/lib/supabase/browser";

export function NewPassword() {
  const router=useRouter();const [password,setPassword]=useState("");const [confirm,setConfirm]=useState("");const [busy,setBusy]=useState(false);const [error,setError]=useState("");
  async function submit(e:React.FormEvent){
    e.preventDefault();if(password!==confirm){setError("Passwords do not match.");return;}
    setBusy(true);setError("");const {error}=await browserSupabase().auth.updateUser({password});setBusy(false);
    if(error){setError(error.message);return;}router.push("/workspace");router.refresh();
  }
  return <form onSubmit={submit}><div className="field"><label htmlFor="new-password">New password</label><input id="new-password" className="input" type="password" autoComplete="new-password" minLength={12} required value={password} onChange={e=>setPassword(e.target.value)}/></div><div className="field"><label htmlFor="confirm-password">Confirm password</label><input id="confirm-password" className="input" type="password" autoComplete="new-password" minLength={12} required value={confirm} onChange={e=>setConfirm(e.target.value)}/></div>{error&&<p className="message error" role="alert">{error}</p>}<button className="button" disabled={busy}>{busy?"Saving…":"Save password"}</button></form>;
}
