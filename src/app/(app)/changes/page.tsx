/**
 * V1 UI spec: /changes — Revenue Change Requests
 */
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import ReviewsTable from "@/components/reviews/ReviewsTable";

const VALID_VIEWS = [
  "all",
  "needs-review",
  "needs-details",
  "overdue",
  "delivery-health",
  "my",
  "in_review",
  "blocked",
  "delivery",
  "needs-my-review",
] as const;
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
  const viewParam = params.view ?? "all";
  const rawView: View = VALID_VIEWS.includes(viewParam as View)
    ? (viewParam as View)
    : "all";
  const view =
    rawView === "needs-my-review"
      ? "needs-review"
      : rawView === "my"
      ? "needs-review"
      : rawView === "in_review"
      ? "all"
      : rawView === "blocked"
      ? "needs-details"
      : rawView === "delivery"
      ? "delivery-health"
      : rawView;
  const learnedRiskFilter = params.learnedRisk === "1";
  const hasIncidentsFilter = params.hasIncidents === "1";

  return (
    <ReviewsTable
      view={view as "all" | "needs-review" | "needs-details" | "overdue" | "delivery-health"}
      learnedRiskFilter={learnedRiskFilter}
      hasIncidentsFilter={hasIncidentsFilter}
    />
  );
}
