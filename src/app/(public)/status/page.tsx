import type { Metadata } from "next";
import { MarketingArticle } from "@/components/marketing/MarketingArticle";

export const metadata: Metadata = {
  title: "Status",
  description: "Solvren service status, availability, incident communication, and maintenance information.",
};

export default function StatusPage() {
  return (
    <MarketingArticle
      title="System status"
      intro="Solvren is preparing a public status page for production environments, incident communication, and scheduled maintenance visibility."
    >
      <p>
        When available, this page will summarize current platform availability, recent incidents, maintenance windows,
        and subscription options for customer notifications. Active customers should continue to use their designated
        support channel for account-specific incident updates until the public status experience is fully linked here.
      </p>
      <p>
        Solvren treats reliability as part of enterprise trust. Operational status, incident communication, and clear
        maintenance expectations are essential for customers who depend on Solvren to monitor revenue-impacting workflows.
      </p>
    </MarketingArticle>
  );
}
