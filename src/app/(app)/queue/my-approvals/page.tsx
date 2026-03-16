import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import ReviewsTable from "@/components/reviews/ReviewsTable";

export default async function MyApprovalsQueuePage({
  searchParams,
}: {
  searchParams: Promise<{ learnedRisk?: string; hasIncidents?: string }>;
}) {
  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) redirect("/login");

  const { data: memberships } = await supabase
    .from("organization_members")
    .select("org_id")
    .eq("user_id", userRes.user.id);

  if (!memberships?.length) redirect("/onboarding");

  const params = await searchParams;
  return (
    <ReviewsTable
      view="my"
      learnedRiskFilter={params.learnedRisk === "1"}
      hasIncidentsFilter={params.hasIncidents === "1"}
    />
  );
}
