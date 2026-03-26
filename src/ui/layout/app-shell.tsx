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
        myWorkCount={0}
        needsReviewCount={0}
      >
        {children}
      </AppShellClient>
    );
  }

  const [
    { count: unreadCount },
    { activeOrgId, memberships },
    { count: needsReviewCount },
    { count: myIssueCount },
  ] = await Promise.all([
    supabase
      .from("in_app_notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", data.user.id)
      .is("read_at", null)
      .then((r) => ({ count: r.count ?? 0 })),
    getActiveOrg(supabase, data.user.id),
    (async () => {
      try {
        const r = await supabase
          .from("approvals")
          .select("id", { count: "exact", head: true })
          .eq("approver_user_id", data.user.id)
          .eq("decision", "PENDING");
        return { count: r.count ?? 0 };
      } catch {
        return { count: 0 };
      }
    })(),
    (async () => {
      try {
        const r = await supabase
          .from("issues")
          .select("id", { count: "exact", head: true })
          .eq("owner_user_id", data.user.id)
          .in("status", ["open", "triaged", "assigned", "in_progress", "resolved"]);
        return { count: r.count ?? 0 };
      } catch {
        return { count: 0 };
      }
    })(),
  ]);
  const myWorkCount = (needsReviewCount ?? 0) + (myIssueCount ?? 0);

  return (
    <AppShellClient
      user={{ id: data.user.id, email: data.user.email ?? undefined }}
      memberships={memberships}
      activeOrgId={activeOrgId}
      unreadCount={unreadCount ?? 0}
      myWorkCount={myWorkCount}
      needsReviewCount={needsReviewCount ?? 0}
    >
      {children}
    </AppShellClient>
  );
}
