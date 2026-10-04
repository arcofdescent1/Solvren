"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Action="acknowledged"|"commented"|"assigned"|"snoozed"|"unsnoozed"|"resolved";
export function IssueActions({orgId,issueId,status,members}:{orgId:string;issueId:string;
  status:string;members:Array<{user_id:string;email:string}>}){
  const router=useRouter();
  const [action,setAction]=useState<Action>("commented");
  const [note,setNote]=useState("");
  const [assignee,setAssignee]=useState(members[0]?.user_id??"");
  const [snoozedUntil,setSnoozedUntil]=useState("");
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState("");
  async function submit(event:React.FormEvent<HTMLFormElement>){
    event.preventDefault();setBusy(true);setMessage("");
    try{
      const response=await fetch(`/api/organizations/${orgId}/issues/${issueId}`,{
        method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({action,note:note||null,assigneeUserId:action==="assigned"?assignee:null,
          snoozedUntil:action==="snoozed"&&snoozedUntil?new Date(snoozedUntil).toISOString():null}),
      });
      const result=await response.json();
      if(!response.ok)throw new Error(result.error??"Could not record action.");
      setNote("");setMessage("Action recorded in the issue history.");router.refresh();
    }catch(error){setMessage(error instanceof Error?error.message:"Could not record action.");}
    finally{setBusy(false);}
  }
  return <section className="card section"><h2>Take action</h2><form className="stack" onSubmit={(event)=>void submit(event)}>
    <label className="field">Action<select className="select" value={action} onChange={(e)=>setAction(e.target.value as Action)}>
      <option value="commented">Add comment</option><option value="assigned">Assign</option>
      {status!=="resolved"&&<><option value="acknowledged">Acknowledge</option><option value="snoozed">Snooze</option><option value="unsnoozed">End snooze</option><option value="resolved">Resolve</option></>}
    </select></label>
    {action==="assigned"&&<label className="field">Assignee<select className="select" value={assignee} onChange={(e)=>setAssignee(e.target.value)}>{members.map((m)=><option key={m.user_id} value={m.user_id}>{m.email}</option>)}</select></label>}
    {action==="snoozed"&&<label className="field">Snooze until<input className="input" type="datetime-local" required value={snoozedUntil} onChange={(e)=>setSnoozedUntil(e.target.value)}/></label>}
    <label className="field">Note{["commented","resolved"].includes(action)?" (required)":" (optional)"}<textarea className="input" rows={3} maxLength={2000} required={["commented","resolved"].includes(action)} value={note} onChange={(e)=>setNote(e.target.value)}/></label>
    <button className="button" disabled={busy}>Record action</button></form>
    {message&&<p className="message section" role="status">{message}</p>}
  </section>;
}
