import Link from "next/link";
import { serverSupabase } from "@/lib/supabase/server";
import { AcceptInvitation } from "./AcceptInvitation";

export default async function InvitationPage({ params }: { params: Promise<{ token:string }> }) {
  const { token }=await params;
  const supabase=await serverSupabase();
  const {data:{user}}=await supabase.auth.getUser();
  const next=`/invite/${token}`;
  return <main className="frame page"><div className="card" style={{maxWidth:610,margin:"30px auto"}}><span className="eyebrow">Private invitation</span><h1 style={{marginTop:18}}>Join your team on Solvren</h1>
    {!user?<><p>Sign in with the email address that received this invitation. Your link will be ready when you return.</p><Link className="button" href={`/sign-in?next=${encodeURIComponent(next)}`}>Sign in to accept</Link></>:
      !user.email_confirmed_at?<><p>Verify {user.email} before accepting this invitation.</p><Link className="button" href="/verify-email">How to verify</Link></>:
      <><p>Signed in as <strong>{user.email}</strong>. This invitation can only be accepted by its intended recipient.</p><AcceptInvitation token={token}/></>}
  </div></main>;
}
