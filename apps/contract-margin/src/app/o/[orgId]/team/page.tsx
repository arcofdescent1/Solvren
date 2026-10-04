import Link from "next/link";
import { redirect } from "next/navigation";
import { organizationAccess } from "@/lib/auth";
import { TeamManager } from "./TeamManager";

export default async function TeamPage({ params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const { supabase, user } = await organizationAccess(orgId, true);
  const [{ data: org }, { data: members, error }, { data: invitations }] = await Promise.all([
    supabase.from("organizations").select("name").eq("id", orgId).single(),
    supabase.rpc("organization_directory", { p_org: orgId }),
    supabase.from("organization_invites").select("id,email,role,expires_at")
      .eq("org_id", orgId).is("accepted_at", null).is("revoked_at", null).gt("expires_at", new Date().toISOString()).order("created_at", { ascending:false }),
  ]);
  if (!org) redirect("/workspace");
  if (error) throw new Error("Could not load the team directory");
  return <main className="frame page">
    <Link className="button ghost" href={`/o/${orgId}`}>← Back to workspace</Link>
    <div className="intro" style={{marginTop:20}}><span className="eyebrow">Organization settings</span><h1 style={{marginTop:18}}>People & access</h1><p>Give each colleague only the access they need in {org.name}. Changes to existing access require a fresh authenticator code.</p></div>
    <TeamManager orgId={orgId} currentUserId={user.id} members={(members??[]) as Array<{user_id:string;email:string;role:"owner"|"finance"|"engineer"|"viewer";joined_at:string}>} invitations={(invitations??[]) as Array<{id:string;email:string;role:string;expires_at:string}>}/>
  </main>;
}
