import type { Metadata } from "next";
import Link from "next/link";
import { MarketingArticle } from "@/components/marketing/MarketingArticle";

export const metadata: Metadata = {
  title: "Executive Risk Engine",
  description: "Executive visibility into revenue risk, operational exposure, and business impact without raw financial data replication.",
};

export default function ExecutiveRiskEnginePage() {
  return (
    <MarketingArticle
      title="Executive Risk Engine"
      intro="Give leadership a clear view of revenue at risk, operational exposure, and urgent decisions—without forcing executives to dig through tickets, spreadsheets, or source systems."
    >
      <p>
        The Executive Risk Engine translates operational signals into executive-ready visibility: what is at risk, why it
        matters, who owns it, and whether the organization is actually making progress. Instead of asking leaders to
        interpret raw workflows, Solvren surfaces the issues most likely to affect revenue, customer experience, or
        operational continuity.
      </p>
      <p>
        Solvren is designed to estimate impact from system behavior, failure rates, approval delays, and workflow
        patterns rather than requiring broad access to sensitive financial records. Impact views should be understood as
        directional operating intelligence, not audited financial reporting.
      </p>
      <p>
        <strong className="text-white">Executives can see:</strong> estimated revenue at risk, readiness trends, blocked
        approvals, unresolved high-priority issues, ownership gaps, ROI from resolved items, and the operational patterns
        that deserve attention now.
      </p>
      <p>
        <strong className="text-white">Built for busy leaders.</strong> Leadership can receive concise digests, approve
        or deny key decisions through external channels where configured, and stay informed without needing to become a
        daily Solvren power user.
      </p>
      <p>
        This surface complements day-to-day workflows in{" "}
        <Link href="/platform/approvals" className="text-cyan-300 underline hover:text-cyan-200">
          Approvals &amp; Readiness
        </Link>{" "}
        and connects to the broader{" "}
        <Link href="/platform" className="text-cyan-300 underline hover:text-cyan-200">
          platform overview
        </Link>
        .
      </p>
    </MarketingArticle>
  );
}
