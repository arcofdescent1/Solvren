"use client";

import { useState } from "react";

export function SupportForm({orgId}:{orgId:string|null}){
  const [email,setEmail]=useState("");
  const [category,setCategory]=useState("product");
  const [subject,setSubject]=useState("");
  const [description,setDescription]=useState("");
  const [website,setWebsite]=useState("");
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [receipt,setReceipt]=useState<{caseId:string;expectedResponseAt:string}|null>(null);
  async function submit(event:React.FormEvent<HTMLFormElement>){
    event.preventDefault();setBusy(true);setError("");
    try{
      const response=await fetch("/api/support",{method:"POST",
        headers:{"Content-Type":"application/json"},body:JSON.stringify({
          email,category,subject,description,website,orgId})});
      const body=await response.json();
      if(!response.ok)throw new Error(body.error??"Could not create a support case.");
      setReceipt(body);setSubject("");setDescription("");
    }catch(reason){setError(reason instanceof Error?reason.message:"Could not create a support case.");}
    finally{setBusy(false);}
  }
  return <form className="card" onSubmit={(event)=>void submit(event)}>
    <h2>Open a support case</h2><p>We will show you a case ID and response window after submission. Do not include API keys, prompts, payment-card data, or sensitive customer records.</p>
    <label className="field">Work email<input className="input" type="email" required
      maxLength={320} autoComplete="email" value={email} onChange={(e)=>setEmail(e.target.value)}/></label>
    <label className="field">What do you need help with?<select className="select" value={category}
      onChange={(e)=>setCategory(e.target.value)}><option value="product">Product</option>
      <option value="integration">Integration or source failure</option><option value="billing">Urgent billing</option>
      <option value="security">Security report</option><option value="deletion">Account deletion</option></select></label>
    <label className="field">Subject<input className="input" required minLength={5} maxLength={160}
      value={subject} onChange={(e)=>setSubject(e.target.value)}/></label>
    <label className="field">Details<textarea className="input" required minLength={15} maxLength={4000}
      rows={5} value={description} onChange={(e)=>setDescription(e.target.value)}/></label>
    <div className="honeypot" aria-hidden="true"><label>Website<input tabIndex={-1} autoComplete="off"
      value={website} onChange={(e)=>setWebsite(e.target.value)}/></label></div>
    <button className="button" disabled={busy}>{busy?"Sending…":"Create support case"}</button>
    {error&&<p className="message error" role="alert">{error}</p>}
    {receipt&&<p className="message" role="status">Case {receipt.caseId} is recorded. Expected first response by {new Date(receipt.expectedResponseAt).toLocaleString()}. Save this case ID for follow-up.</p>}
  </form>;
}
