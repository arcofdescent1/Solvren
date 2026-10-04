import { redirect } from "next/navigation";
import { verifiedUser } from "@/lib/auth";

export default async function WorkspacePage() {
  const { supabase, user } = await verifiedUser();
  const { data, error } = await supabase.from("organization_members")
    .select("org_id,role").eq("user_id", user.id).order("created_at");
  if (error) throw new Error("Could not load your organizations");
  if (!data?.length) redirect("/new-organization");
  const first = data[0];
  if (first.role !== "viewer") {
    const { data: assurance } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (assurance?.currentLevel !== "aal2") redirect(`/mfa?next=${encodeURIComponent(`/o/${first.org_id}`)}`);
  }
  redirect(`/o/${first.org_id}`);
}
