import type { Metadata } from "next";
import Link from "next/link";
import { MarketingArticle } from "@/components/marketing/MarketingArticle";

export const metadata: Metadata = {
  title: "Executive Risk Engine",
  description: "Executive visibility for revenue-impacting change and risk.",
};

export default function ExecutiveRiskEnginePage() {
  return (
    <MarketingArticle
      title="Executive Risk Engine"
      intro="Give leadership a live view of exposure across revenue systems: blocked changes, readiness gaps, SLA pressure, and predicted risk—without digging through tickets."
    >
      <p>
        Dashboards and digests summarize what is in flight, what needs attention, and where automation has reduced manual
        coordination. Evidence and approvals stay linked to each change for audit and post-incident review.
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
