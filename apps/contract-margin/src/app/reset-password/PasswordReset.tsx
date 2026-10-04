"use client";

import { useState } from "react";
import Link from "next/link";
import { browserSupabase } from "@/lib/supabase/browser";

export function PasswordReset() {
  const [email,setEmail]=useState("");const [sent,setSent]=useState(false);const [busy,setBusy]=useState(false);const [error,setError]=useState("");
  async function submit(e:React.FormEvent){
    e.preventDefault();setBusy(true);setError("");
    const {error}=await browserSupabase().auth.resetPasswordForEmail(email.trim().toLowerCase(),{
      redirectTo:`${location.origin}/auth/callback?next=${encodeURIComponent("/reset-password/update")}`,
    });
    setBusy(false);if(error){setError(error.message);return;}setSent(true);
  }
  if(sent)return <><p className="message">If that account exists, its reset link is on the way.</p><Link className="button secondary" href="/sign-in">Back to sign in</Link></>;
  return <form onSubmit={submit}><div className="field"><label htmlFor="reset-email">Email address</label><input id="reset-email" className="input" type="email" autoComplete="email" required value={email} onChange={e=>setEmail(e.target.value)}/></div>{error&&<p className="message error" role="alert">{error}</p>}<button className="button" disabled={busy}>{busy?"Sending…":"Send reset link"}</button></form>;
}
