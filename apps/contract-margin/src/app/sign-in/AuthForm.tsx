"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { browserSupabase } from "@/lib/supabase/browser";
import Link from "next/link";

export function AuthForm({ next, initialError }: { next: string; initialError?: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState(initialError ?? "");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setMessage("");
    const supabase = browserSupabase();
    const normalized = email.trim().toLowerCase();
    const result = mode === "up"
      ? await supabase.auth.signUp({ email: normalized, password, options: { emailRedirectTo: `${location.origin}/auth/callback?next=${encodeURIComponent(next)}` } })
      : await supabase.auth.signInWithPassword({ email: normalized, password });
    setBusy(false);
    if (result.error) { setMessage(result.error.message); return; }
    if (mode === "up") { router.push("/verify-email"); return; }
    router.push(next); router.refresh();
  }

  async function oauth(provider: "google" | "azure") {
    setBusy(true); setMessage("");
    const { error } = await browserSupabase().auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
        ...(provider === "azure" ? { scopes: "email" } : {}),
      },
    });
    if (error) { setMessage(error.message); setBusy(false); }
  }

  return <>
    <span className="eyebrow">Secure access</span>
    <h2 style={{marginTop:20}}>{mode === "in" ? "Welcome back" : "Create your account"}</h2>
    <p>{mode === "in" ? "Sign in to your Solvren workspace." : "Use your work email to get started."}</p>
    <div className="stack" style={{marginTop:25}}>
      <button className="button secondary full" type="button" disabled={busy} onClick={() => oauth("google")}>Continue with Google</button>
      <button className="button secondary full" type="button" disabled={busy} onClick={() => oauth("azure")}>Continue with Microsoft</button>
    </div>
    <div className="divider">or use your work email</div>
    <form onSubmit={submit}>
      <div className="field"><label htmlFor="email">Email address</label><input className="input" id="email" type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} required/></div>
      <div className="field"><label htmlFor="password">Password</label><input className="input" id="password" type="password" autoComplete={mode === "in" ? "current-password" : "new-password"} minLength={mode === "up" ? 12 : undefined} value={password} onChange={e=>setPassword(e.target.value)} required/></div>
      {mode === "in" && <div style={{textAlign:"right"}}><Link className="small" style={{color:"var(--teal-deep)"}} href="/reset-password">Forgot password?</Link></div>}
      {mode === "up" && <p className="hint">Use at least 12 characters. We’ll verify your email before you can enter a workspace.</p>}
      {message && <p className={`message ${mode === "up" && message.includes("check") ? "" : "error"}`} role="alert">{message}</p>}
      <button className="button full" disabled={busy} style={{marginTop:12}}>{busy ? "Please wait…" : mode === "in" ? "Sign in" : "Create account"}</button>
    </form>
    <p className="small" style={{marginTop:25}}>{mode === "in" ? "New to Solvren?" : "Already have an account?"} <button className="button ghost" type="button" onClick={()=>{setMode(mode==="in"?"up":"in");setMessage("");}}>{mode === "in" ? "Create account" : "Sign in"}</button></p>
  </>;
}
