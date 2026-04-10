"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import OpsInbox from "@/components/reviews/OpsInbox";
import ReviewsTable from "@/components/reviews/ReviewsTable";

type Props = {
  view: "inbox" | "list";
  learnedRiskFilter: boolean;
  hasIncidentsFilter: boolean;
};

type TableView = "my" | "in_review" | "blocked" | "overdue" | "delivery";

export default function ReviewsPageClient({
  view,
  learnedRiskFilter,
  hasIncidentsFilter,
}: Props) {
  const searchParams = useSearchParams();
  const isInbox = view === "inbox";
  const tableViewParam = searchParams.get("view") ?? "in_review";
  const tableView: TableView =
    ["my", "in_review", "blocked", "overdue", "delivery"].includes(tableViewParam)
      ? (tableViewParam as TableView)
      : "in_review";

  const listHref = () => {
    const next = new URLSearchParams(searchParams.toString());
    next.set("view", "list");
    if (learnedRiskFilter) next.set("learnedRisk", "1");
    if (hasIncidentsFilter) next.set("hasIncidents", "1");
    return `/reviews?${next.toString()}`;
  };
  const inboxHref = () => "/reviews";

  return (
    <div className="min-h-screen">
      <div className="border-b bg-black/[0.02] px-6 py-2 flex items-center gap-4">
        <Link
          href={inboxHref()}
          className={`text-sm font-medium ${isInbox ? "underline" : "opacity-70 hover:underline"}`}
        >
          Ops Inbox
        </Link>
        <Link
          href={listHref()}
          className={`text-sm font-medium ${!isInbox ? "underline" : "opacity-70 hover:underline"}`}
        >
          All reviews (list)
        </Link>
      </div>
      {isInbox ? (
        <OpsInbox />
      ) : (
        <ReviewsTable
          view={tableView}
          learnedRiskFilter={learnedRiskFilter}
          hasIncidentsFilter={hasIncidentsFilter}
        />
      )}
    </div>
  );
}
