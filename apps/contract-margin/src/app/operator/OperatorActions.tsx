"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function OperatorActions({kind,id,state}:{kind:"ticket"|"incident"|"new-incident";
  id:string;state:string}){
  const router=useRouter();
  const [busy,setBusy]=useState(false);const [message,setMessage]=useState("");
  const [title,setTitle]=useState("");const [summary,setSummary]=useState("");
  const [severity,setSeverity]=useState("degraded");
  async function update(value:string){
    setBusy(true);setMessage("");
    const url=kind==="ticket"?`/api/operator/tickets/${id}`:
      kind==="incident"?`/api/operator/incidents/${id}`:"/api/operator/incidents";
    try{
      const response=await fetch(url,{method:kind==="new-incident"?"POST":"PATCH",
        headers:{"Content-Type":"application/json"},body:JSON.stringify(kind==="new-incident"?
          {title,summary,severity,published:true}: {status:value})});
      const result=await response.json();
      if(!response.ok)throw new Error(result.error??"Action failed.");
      setTitle("");setSummary("");router.refresh();
    }catch(error){setMessage(error instanceof Error?error.message:"Action failed.");}
    finally{setBusy(false);}
  }
  if(kind==="new-incident")return <form className="import-tile section"
    onSubmit={(event)=>{event.preventDefault();void update("");}}>
    <h3>Publish an incident</h3><label className="field">Title<input className="input" required minLength={5}
      maxLength={160} value={title} onChange={(event)=>setTitle(event.target.value)}/></label>
    <label className="field">Customer-safe update<textarea className="input" required minLength={15}
      maxLength={2000} rows={3} value={summary} onChange={(event)=>setSummary(event.target.value)}/></label>
    <label className="field">Severity<select className="select" value={severity}
      onChange={(event)=>setSeverity(event.target.value)}><option value="degraded">Degraded</option>
      <option value="outage">Outage</option><option value="maintenance">Maintenance</option></select></label>
    <button className="button" disabled={busy}>Publish incident</button>
    {message&&<p className="message error" role="alert">{message}</p>}</form>;
  return <div><select className="select" aria-label={kind==="ticket"?"Case status":"Incident status"}
    defaultValue={state} disabled={busy} onChange={(event)=>void update(event.target.value)}>
    {kind==="ticket"? ["open","in_progress","waiting","resolved"].map((item)=><option key={item} value={item}>{item.replaceAll("_"," ")}</option>):
      ["investigating","identified","monitoring","resolved"].map((item)=><option key={item} value={item}>{item}</option>)}</select>
    {message&&<p className="message error" role="alert">{message}</p>}</div>;
}

export function RetryLifecycle({id}:{id:string}){
  const router=useRouter();
  const [busy,setBusy]=useState(false);const [message,setMessage]=useState("");
  async function retry(){
    setBusy(true);setMessage("");
    try{
      const response=await fetch(`/api/operator/lifecycle/${id}/retry`,{method:"POST"});
      if(!response.ok)throw new Error("Could not retry delivery.");
      router.refresh();
    }catch(error){setMessage(error instanceof Error?error.message:"Could not retry delivery.");}
    finally{setBusy(false);}
  }
  return <span><button className="button secondary" type="button" disabled={busy}
    onClick={()=>void retry()}>Retry</button>
    {message&&<small role="alert">{message}</small>}</span>;
}
