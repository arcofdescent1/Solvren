import Link from "next/link";
import { redirect } from "next/navigation";
import { ShieldCheck, UsersRound, ArrowUpRight, Building2 } from "lucide-react";
import { organizationAccess } from "@/lib/auth";
import { SignOutButton } from "@/components/SignOutButton";

export default async function OrganizationPage({ params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const { supabase, user, role } = await organizationAccess(orgId);
  const [{ data: organization }, { data: memberships }] = await Promise.all([
    supabase.from("organizations").select("name").eq("id", orgId).maybeSingle(),
    supabase.from("organization_members").select("org_id,role").eq("user_id", user.id).order("created_at"),
  ]);
  if (!organization) redirect("/workspace");
  const otherIds = (memberships ?? []).filter(m=>m.org_id!==orgId);
  const { data: otherOrganizations } = otherIds.length
    ? await supabase.from("organizations").select("id,name").in("id", otherIds.map(m=>m.org_id))
    : { data: [] as Array<{ id:string; name:string }> };
  return <main className="frame page">
    <div className="toolbar" style={{marginTop:0}}><span className="eyebrow">Your workspace</span><div className="top-links"><span>{user.email}</span><SignOutButton/></div></div>
    <div className="intro"><h1>{organization.name}</h1><p>A clear, private home for the people responsible for this organization. Your access is limited to the role shown below.</p><span className="pill">{role}</span></div>
    <div className="grid">
      {role==="owner"&&<Link href={`/o/${orgId}/team`} className="card" style={{display:"block"}}><div className="card-icon"><UsersRound size={20}/></div><div className="card-head"><h2>People & access</h2><ArrowUpRight size={18}/></div><p>Invite colleagues, choose their access, and manage ownership.</p></Link>}
      <Link href="/mfa" className="card" style={{display:"block"}}><div className="card-icon"><ShieldCheck size={20}/></div><div className="card-head"><h2>Account security</h2><ArrowUpRight size={18}/></div><p>Review your authenticator and sign out of all devices.</p></Link>
      <div className="card"><div className="card-icon"><Building2 size={20}/></div><h2>Your organizations</h2><p>Move between workspaces you belong to.</p>
        <div className="stack">{(otherOrganizations??[]).map(org=><Link className="button secondary" href={`/o/${org.id}`} key={org.id}>{org.name}</Link>)}<Link className="button secondary" href="/new-organization">Create another organization</Link></div>
      </div>
    </div>
  </main>;
}
