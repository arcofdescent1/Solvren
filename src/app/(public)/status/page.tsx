import type { Metadata } from "next";
import { MarketingArticle } from "@/components/marketing/MarketingArticle";

export const metadata: Metadata = {
  title: "Status",
  description: "Solvren service status and uptime information.",
};

export default function StatusPage() {
  return (
    <MarketingArticle
      title="Status"
      intro="We are preparing a public status page for Solvren production environments. Until it is linked here, customers with active agreements should use their designated support channel for incident updates."
    >
      <p>
        When available, this page will summarize current operational status, recent incidents, and scheduled
        maintenance. Subscribe options will be announced in product release notes.
      </p>
    </MarketingArticle>
  );
}
