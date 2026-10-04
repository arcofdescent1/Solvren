"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function OperatorAccessForm({active}:{active:boolean}){
  const router=useRouter();
  const [reason,setReason]=useState("");const [code,setCode]=useState("");
  const [busy,setBusy]=useState(false);const [message,setMessage]=useState("");
  async function act(method:"POST"|"DELETE"){
    setBusy(true);setMessage("");
    try{
      const response=await fetch("/api/operator/access",{method,
        headers:{"Content-Type":"application/json"},
        body:method==="POST"?JSON.stringify({reason,code}):undefined});
      const result=await response.json();
      if(!response.ok)throw new Error(result.error??"Operator access failed.");
      router.refresh();
    }catch(error){setMessage(error instanceof Error?error.message:"Operator access failed.");}
    finally{setBusy(false);}
  }
  if(active)return <div><button className="button secondary" type="button" disabled={busy}
    onClick={()=>void act("DELETE")}>End operator access</button>
    {message&&<p className="message" role="alert">{message}</p>}</div>;
  return <form className="card" onSubmit={(event)=>{event.preventDefault();void act("POST");}}>
    <h2>Open a 30-minute diagnostic session</h2>
    <p>Your operator user ID must be explicitly approved in deployment configuration. Each session requires a fresh authenticator code and a specific reason. Customer contract values are not shown here.</p>
    <label className="field">Reason<input className="input" minLength={15} maxLength={500}
      required value={reason} onChange={(event)=>setReason(event.target.value)}/></label>
    <label className="field">Authenticator code<input className="input" inputMode="numeric"
      pattern="[0-9]{6}" minLength={6} maxLength={6} required value={code}
      onChange={(event)=>setCode(event.target.value)}/></label>
    <button className="button" disabled={busy}>Open diagnostic session</button>
    {message&&<p className="message error" role="alert">{message}</p>}
  </form>;
}
