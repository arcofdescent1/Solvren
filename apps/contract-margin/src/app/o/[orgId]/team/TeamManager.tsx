"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Role = "owner"|"finance"|"engineer"|"viewer";
type Member = { user_id:string;email:string;role:Role;joined_at:string };
type Invite = { id:string;email:string;role:string;expires_at:string };
const roles: Array<{value:Exclude<Role,"owner">;label:string}> = [
  {value:"finance",label:"Finance — contracts and reports"},
  {value:"engineer",label:"Engineer — data connections"},
  {value:"viewer",label:"Viewer — read only"},
];

export function TeamManager({orgId,currentUserId,members,invitations}:{orgId:string;currentUserId:string;members:Member[];invitations:Invite[]}) {
  const router=useRouter();
  const [email,setEmail]=useState("");
  const [inviteRole,setInviteRole]=useState<Exclude<Role,"owner">>("viewer");
  const [inviteCode,setInviteCode]=useState("");
  const [editing,setEditing]=useState<string|null>(null);
  const [operation,setOperation]=useState<"role"|"remove"|"transfer">("role");
  const [newRole,setNewRole]=useState<Exclude<Role,"owner">>("viewer");
  const [code,setCode]=useState("");
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState("");
  const [isError,setIsError]=useState(false);
  function notice(value:string,error=false){setMessage(value);setIsError(error);}
  async function sendInvite(e:React.FormEvent){
    e.preventDefault();setBusy(true);notice("");
    try {
      const res=await fetch(`/api/organizations/${orgId}/invites`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email,role:inviteRole,code:inviteCode})});
      const data=await res.json();
      if(!res.ok)throw new Error(data.error??"Invitation failed.");
      setEmail("");setInviteCode("");notice("Invitation sent. The link expires in seven days.");router.refresh();
    }catch(e){notice(e instanceof Error?e.message:"Invitation failed.",true)}finally{setBusy(false)}
  }
  async function revoke(inviteId:string){
    setBusy(true);notice("");
    try {
      const res=await fetch(`/api/organizations/${orgId}/invites/${inviteId}`,{method:"DELETE"});
      const data=await res.json();if(!res.ok)throw new Error(data.error??"Could not revoke invitation.");
      notice("Invitation revoked.");router.refresh();
    }catch(e){notice(e instanceof Error?e.message:"Could not revoke invitation.",true)}finally{setBusy(false)}
  }
  async function change(member:Member){
    setBusy(true);notice("");
    try {
      const url=operation==="transfer"?`/api/organizations/${orgId}/transfer`:`/api/organizations/${orgId}/members/${member.user_id}`;
      const method=operation==="role"?"PATCH":operation==="remove"?"DELETE":"POST";
      const body=operation==="role"?{role:newRole,code}:operation==="transfer"?{userId:member.user_id,code}:{code};
      const res=await fetch(url,{method,headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
      const data=await res.json();if(!res.ok)throw new Error(data.error??"Access change failed.");
      setEditing(null);setCode("");notice(operation==="transfer"?"Ownership transferred.":operation==="remove"?"Member removed.":"Role updated.");
      router.refresh();if(operation==="transfer")router.push(`/o/${orgId}`);
    }catch(e){notice(e instanceof Error?e.message:"Access change failed.",true)}finally{setBusy(false)}
  }
  return <>
    <section className="card"><h2>Invite a colleague</h2><p>They’ll get a private link at the address you enter.</p>
      <form className="inline-form" onSubmit={sendInvite}>
        <div className="field"><label htmlFor="invite-email">Work email</label><input className="input" id="invite-email" type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="name@company.com" required/></div>
        <div className="field"><label htmlFor="invite-role">Access</label><select className="select" id="invite-role" value={inviteRole} onChange={e=>setInviteRole(e.target.value as Exclude<Role,"owner">)}>{roles.map(r=><option key={r.value} value={r.value}>{r.label}</option>)}</select></div>
        <div className="field" style={{flex:"0 1 165px"}}><label htmlFor="invite-code">Authenticator code</label><input className="input code" id="invite-code" type="text" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} value={inviteCode} onChange={e=>setInviteCode(e.target.value.replace(/\D/g,"").slice(0,6))} required/></div>
        <button className="button" disabled={busy||inviteCode.length!==6}>Send invitation</button>
      </form>
    </section>
    {message&&<p className={`message ${isError?"error":""}`} role="alert" style={{marginTop:20}}>{message}</p>}
    <section className="card section"><div className="section-heading"><div><h2>Members</h2><p>Access changes take effect immediately.</p></div><span className="pill">{members.length} people</span></div>
      {members.map(member=><div className="row" key={member.user_id}>
        <div><div className="row-title">{member.email}{member.user_id===currentUserId?" · You":""}</div><div className="row-sub">Joined {new Date(member.joined_at).toLocaleDateString()}</div></div>
        <div className="inline-form"><span className="pill">{member.role}</span>{member.user_id!==currentUserId&&<button className="button secondary" onClick={()=>{setEditing(editing===member.user_id?null:member.user_id);setOperation("role");setNewRole(member.role==="owner"?"finance":member.role);setCode("");}}>{editing===member.user_id?"Close":"Manage"}</button>}</div>
        {editing===member.user_id&&<div className="card" style={{width:"100%",background:"#f8fbfa"}}>
          <div className="field"><label htmlFor="action">Change</label><select id="action" className="select" value={operation} onChange={e=>setOperation(e.target.value as typeof operation)}><option value="role">Change role</option><option value="remove">Remove member</option><option value="transfer">Transfer ownership</option></select></div>
          {operation==="role"&&<div className="field"><label htmlFor="new-role">New role</label><select id="new-role" className="select" value={newRole} onChange={e=>setNewRole(e.target.value as Exclude<Role,"owner">)}>{roles.map(r=><option key={r.value} value={r.value}>{r.label}</option>)}</select></div>}
          <p className="small">{operation==="transfer"?"You will become a Finance member. This action changes who controls the organization.":operation==="remove"?"This person will lose access to this organization immediately.":"The new role takes effect immediately."}</p>
          <div className="field"><label htmlFor="confirm-code">Your authenticator code</label><input id="confirm-code" className="input code" type="text" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,"").slice(0,6))}/></div>
          <button className={`button ${operation!=="role"?"danger":""}`} disabled={busy||code.length!==6} onClick={()=>change(member)}>{busy?"Saving…":operation==="transfer"?"Transfer ownership":operation==="remove"?"Remove member":"Save role"}</button>
        </div>}
      </div>)}
    </section>
    <section className="card section"><div className="section-heading"><div><h2>Pending invitations</h2><p>Links expire after seven days.</p></div><span className="pill">{invitations.length} pending</span></div>
      {invitations.length===0?<p>No pending invitations.</p>:invitations.map(invite=><div className="row" key={invite.id}><div><div className="row-title">{invite.email}</div><div className="row-sub">{invite.role} · Expires {new Date(invite.expires_at).toLocaleDateString()}</div></div><button className="button secondary" disabled={busy} onClick={()=>revoke(invite.id)}>Revoke</button></div>)}
    </section>
  </>;
}
