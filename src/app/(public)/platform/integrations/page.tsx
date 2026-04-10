import type { Metadata } from "next";
import Link from "next/link";
import { MarketingArticle } from "@/components/marketing/MarketingArticle";

export const metadata: Metadata = {
  title: "Integrations",
  description: "Integrations that connect Solvren to your revenue and operations stack.",
};

/**
 * Marketing integrations overview. Authenticated integration management remains at `/integrations` (app hub).
 */
export default function PlatformIntegrationsMarketingPage() {
  return (
    <MarketingArticle
      title="Integrations"
      intro="Solvren integrates with ticketing, chat, identity, and data sources so change context, evidence, and notifications stay synchronized."
    >
      <p>
        Supported connectors depend on your plan and configuration. Typical categories include issue tracking, messaging
        for approvals and nudges, CRM and billing context, and warehouse or spreadsheet ingestion for reporting.
      </p>
      <p>
        For the latest connector list and setup steps, see{" "}
        <Link href="/docs" className="text-cyan-300 underline hover:text-cyan-200">
          documentation
        </Link>
        . To discuss enterprise requirements,{" "}
        <Link href="/contact" className="text-cyan-300 underline hover:text-cyan-200">
          contact us
        </Link>
        . If you already use Solvren, open the{" "}
        <Link href="/integrations" className="text-cyan-300 underline hover:text-cyan-200">
          integrations hub
        </Link>{" "}
        in your workspace.
      </p>
    </MarketingArticle>
  );
}
