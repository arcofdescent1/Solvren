"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function RetryDeliveryButton({orgId}:{orgId:string}){
  const router=useRouter();
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState("");
  async function retry(){
    setBusy(true);setMessage("");
    try{
      const response=await fetch(`/api/organizations/${orgId}/alert-deliveries/retry`,
        {method:"POST"});
      const body=await response.json();
      if(!response.ok)throw new Error(body.error??"Could not retry email delivery.");
      setMessage(`${body.retried} failed deliveries returned to the queue.`);
      router.refresh();
    }catch(error){setMessage(error instanceof Error?error.message:"Retry failed.");}
    finally{setBusy(false);}
  }
  return <div className="section"><button className="button secondary" type="button" disabled={busy}
    onClick={()=>void retry()}>Retry failed email deliveries</button>
    {message&&<p className="message" role="status">{message}</p>}</div>;
}
