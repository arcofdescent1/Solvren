import { createServerSupabaseClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { PageHeader, Card, CardBody } from "@/ui";
import NotificationsList from "@/components/NotificationsList";

export default async function NotificationsPage() {
  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) redirect("/login");

  const { data: notifications } = await supabase
    .from("in_app_notifications")
    .select("id, title, body, severity, cta_label, cta_url, read_at, created_at")
    .eq("user_id", userRes.user.id)
    .order("created_at", { ascending: false })
    .limit(100);

  return (
    <div className="space-y-4">
      <PageHeader
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Notifications" },
        ]}
        title="Notifications"
        right={
          <a href="/dashboard" className="text-sm font-semibold text-[var(--primary)] hover:underline">
            ← Dashboard
          </a>
        }
      />

      <Card>
        <CardBody>
          <NotificationsList
            initial={(notifications ?? []) as Parameters<typeof NotificationsList>[0]["initial"]}
          />
        </CardBody>
      </Card>
    </div>
  );
}
