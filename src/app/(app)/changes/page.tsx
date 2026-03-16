/**
 * V1 UI spec: /changes — Revenue Change Requests
 */
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import ReviewsTable from "@/components/reviews/ReviewsTable";

const VALID_VIEWS = ["my", "in_review", "blocked", "overdue", "delivery"] as const;
type View = (typeof VALID_VIEWS)[number];

export default async function ChangesPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; learnedRisk?: string; hasIncidents?: string }>;
}) {
  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) redirect("/login");

  const { data: memberships } = await supabase
    .from("organization_members")
    .select("org_id");

  if (!memberships?.length) redirect("/onboarding");

  const params = await searchParams;
  const viewParam = params.view ?? "in_review";
  const view: View = VALID_VIEWS.includes(viewParam as View)
    ? (viewParam as View)
    : "in_review";
  const learnedRiskFilter = params.learnedRisk === "1";
  const hasIncidentsFilter = params.hasIncidents === "1";

  return (
    <ReviewsTable
      view={view}
      learnedRiskFilter={learnedRiskFilter}
      hasIncidentsFilter={hasIncidentsFilter}
    />
  );
}
