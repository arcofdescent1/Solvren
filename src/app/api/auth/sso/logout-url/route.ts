/**
 * GET /api/auth/sso/logout-url
 * Returns IdP end_session_endpoint for the current user if they logged in via SSO and provider has it set.
 * Client should sign out locally then redirect to this URL when present.
 */
import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) {
    return NextResponse.json({ logoutUrl: null });
  }

  const admin = createAdminClient();
  const { data: identities } = await admin
    .from("external_identities")
    .select("provider_id")
    .eq("user_id", userRes.user.id)
    .limit(5);

  if (!identities?.length) {
    return NextResponse.json({ logoutUrl: null });
  }

  const providerIds = (identities as Array<{ provider_id: string }>).map((i) => i.provider_id);
  const { data: providers } = await admin
    .from("sso_providers")
    .select("end_session_endpoint")
    .in("id", providerIds);

  const withEndpoint = (providers ?? []).find(
    (p) => (p as { end_session_endpoint?: string | null }).end_session_endpoint
  );
  const url = withEndpoint
    ? (withEndpoint as { end_session_endpoint: string }).end_session_endpoint
    : null;

  return NextResponse.json({ logoutUrl: url });
}
