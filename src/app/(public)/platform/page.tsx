import type { Metadata } from "next";
import Link from "next/link";
import { MarketingArticle } from "@/components/marketing/MarketingArticle";

export const metadata: Metadata = {
  title: "Platform Overview",
  description: "Overview of the Solvren revenue protection platform.",
};

export default function PlatformOverviewPage() {
  return (
    <MarketingArticle
      title="Platform overview"
      intro="Solvren unifies intake, risk intelligence, coordination, approvals, and outcomes so revenue-impacting change is governed end to end."
    >
      <p>
        The platform connects to the systems your teams already use, normalizes change context, and applies governance
        rules so the right evidence and approvers are in place before release.
      </p>
      <p>
        <strong className="text-white">Deep dives.</strong> Explore the{" "}
        <Link href="/platform/executive-risk-engine" className="text-cyan-300 underline hover:text-cyan-200">
          Executive Risk Engine
        </Link>{" "}
        for leadership visibility and the{" "}
        <Link href="/platform/approvals" className="text-cyan-300 underline hover:text-cyan-200">
          Approvals &amp; Readiness
        </Link>{" "}
        surface for operational control, and review{" "}
        <Link href="/platform/integrations" className="text-cyan-300 underline hover:text-cyan-200">
          Integrations
        </Link>{" "}
        for how Solvren connects to your stack.
      </p>
      <p>
        Ready to see it in your environment?{" "}
        <Link href="/contact" className="text-cyan-300 underline hover:text-cyan-200">
          Talk to sales
        </Link>{" "}
        or review{" "}
        <Link href="/pricing" className="text-cyan-300 underline hover:text-cyan-200">
          pricing
        </Link>
        .
      </p>
    </MarketingArticle>
  );
}
