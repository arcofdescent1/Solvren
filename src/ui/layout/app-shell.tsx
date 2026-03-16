import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getActiveOrg } from "@/lib/org/activeOrg";
import { AppShellClient } from "./AppShellClient";

export async function AppShell({ children }: { children: React.ReactNode }) {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase.auth.getUser();

  if (!data.user) {
    return (
      <AppShellClient
        user={null}
        memberships={[]}
        activeOrgId={null}
        unreadCount={0}
      >
        {children}
      </AppShellClient>
    );
  }

  const [
    { count: unreadCount },
    { activeOrgId, memberships },
  ] = await Promise.all([
    supabase
      .from("in_app_notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", data.user.id)
      .is("read_at", null)
      .then((r) => ({ count: r.count ?? 0 })),
    getActiveOrg(supabase, data.user.id),
  ]);

  return (
    <AppShellClient
      user={{ id: data.user.id, email: data.user.email ?? undefined }}
      memberships={memberships}
      activeOrgId={activeOrgId}
      unreadCount={unreadCount ?? 0}
    >
      {children}
    </AppShellClient>
  );
}
