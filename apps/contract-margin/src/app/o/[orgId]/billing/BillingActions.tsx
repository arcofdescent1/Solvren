"use client";

import { useState } from "react";

export function BillingActions({orgId,hasCustomer,hasSubscription}:{orgId:string;
  hasCustomer:boolean;hasSubscription:boolean}){
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState("");
  async function open(kind:"month"|"year"|"portal"){
    setBusy(true);setMessage("");
    try{
      const route=kind==="portal"?"portal":"checkout";
      const response=await fetch(`/api/organizations/${orgId}/billing/${route}`,{
        method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify(kind==="portal"?{}:{interval:kind})});
      const body=await response.json();
      if(!response.ok)throw new Error(body.error??"Billing is unavailable.");
      const url=new URL(body.url);
      if(url.protocol!=="https:"||
        (route==="portal"?url.hostname!=="billing.stripe.com":url.hostname!=="checkout.stripe.com"))
        throw new Error("Invalid billing destination.");
      window.location.assign(url.toString());
    }catch(error){setMessage(error instanceof Error?error.message:"Billing is unavailable.");
      setBusy(false);}
  }
  return <div className="stack">
    {!hasSubscription&&<div className="inline-form"><button className="button" type="button"
      disabled={busy} onClick={()=>void open("month")}>Subscribe monthly · $1,500</button>
      <button className="button secondary" type="button" disabled={busy}
        onClick={()=>void open("year")}>Subscribe annually · $15,000</button></div>}
    {hasCustomer&&<button className="button secondary" type="button" disabled={busy}
      onClick={()=>void open("portal")}>Manage payment, invoices, or cancellation</button>}
    {message&&<p className="message" role="alert">{message}</p>}
  </div>;
}
