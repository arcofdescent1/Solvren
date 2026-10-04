"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function AcceptInvitation({token}:{token:string}) {
  const router=useRouter();const [busy,setBusy]=useState(false);const [error,setError]=useState("");
  async function accept(){
    setBusy(true);setError("");
    try {
      const res=await fetch("/api/invitations/accept",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({token})});
      const data=await res.json();if(!res.ok)throw new Error(data.error??"Could not accept invitation.");
      router.push(`/o/${data.organizationId}`);router.refresh();
    }catch(e){setError(e instanceof Error?e.message:"Could not accept invitation.");setBusy(false)}
  }
  return <><button className="button" disabled={busy} onClick={accept}>{busy?"Joining…":"Accept invitation"}</button>{error&&<p className="message error" role="alert" style={{marginTop:15}}>{error}</p>}</>;
}
