"use client";

import { useState } from "react";
import { browserSupabase } from "@/lib/supabase/browser";

export function ResendVerification() {
  const [email,setEmail]=useState("");const [busy,setBusy]=useState(false);const [message,setMessage]=useState("");
  async function submit(e:React.FormEvent){
    e.preventDefault();setBusy(true);setMessage("");
    const {error}=await browserSupabase().auth.resend({
      type:"signup",email:email.trim().toLowerCase(),
      options:{emailRedirectTo:`${location.origin}/auth/callback?next=${encodeURIComponent("/workspace")}`},
    });
    setBusy(false);
    setMessage(error?error.message:"If that address has a pending account, a fresh link is on the way.");
  }
  return <form onSubmit={submit} style={{margin:"20px 0 24px"}}><div className="field"><label htmlFor="verification-email">Need a new link?</label><input className="input" id="verification-email" type="email" autoComplete="email" placeholder="name@company.com" value={email} onChange={e=>setEmail(e.target.value)} required/></div><button className="button secondary" disabled={busy}>{busy?"Sending…":"Resend verification"}</button>{message&&<p className="message" role="status" style={{marginTop:12}}>{message}</p>}</form>;
}
