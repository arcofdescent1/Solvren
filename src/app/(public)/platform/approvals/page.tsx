import type { Metadata } from "next";
import Link from "next/link";
import { MarketingArticle } from "@/components/marketing/MarketingArticle";

export const metadata: Metadata = {
  title: "Approvals & Readiness",
  description: "Structured approvals, evidence, and readiness for revenue-impacting change.",
};

export default function PlatformApprovalsPage() {
  return (
    <MarketingArticle
      title="Approvals & Readiness"
      intro="Ensure every revenue-impacting change clears the right gates: domain rules, evidence, approvals, and readiness checks—before production."
    >
      <p>
        Solvren maps requirements to your organization’s governance templates, surfaces missing approvals or evidence,
        and coordinates action across Slack and other channels so teams spend less time chasing status.
      </p>
      <p>
        Readiness snapshots and predictions highlight deterioration early, while audit trails capture who approved what
        and when. Pair this with the{" "}
        <Link href="/platform/executive-risk-engine" className="text-cyan-300 underline hover:text-cyan-200">
          Executive Risk Engine
        </Link>{" "}
        for portfolio-level visibility.
      </p>
    </MarketingArticle>
  );
}
