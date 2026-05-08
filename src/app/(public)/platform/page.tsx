import type { Metadata } from "next";
import Link from "next/link";
import { MarketingArticle } from "@/components/marketing/MarketingArticle";

export const metadata: Metadata = {
  title: "Platform Overview",
  description: "Solvren platform overview for revenue risk intelligence, governance, and privacy-first operational execution.",
};

export default function PlatformOverviewPage() {
  return (
    <MarketingArticle
      title="Platform overview"
      intro="Solvren is a revenue risk intelligence platform that detects operational failures, prioritizes action, and coordinates resolution using system signals—not source-of-truth financial or customer data."
    >
      <p>
        Solvren connects to the systems your teams already use and turns event-level signals, workflow changes, and
        operational metadata into a clear view of what is at risk, who owns it, and what should happen next. The goal is
        not to replicate your CRM, billing platform, or data warehouse. The goal is to identify the issues that can cost
        revenue before they become expensive surprises.
      </p>
      <p>
        The platform combines signal ingestion, data minimization, risk scoring, approvals, ownership routing, audit
        trails, and executive visibility in one closed-loop operating system. Teams can start in a minimal-data posture,
        keep integrations read-only by default, and expand access only when there is a clear business reason.
      </p>
      <p>
        <strong className="text-white">What Solvren is designed to handle.</strong> Revenue-impacting changes, broken
        workflows, missed handoffs, approval gaps, integration failures, operational drift, and repeatable issues that
        are usually discovered too late or prioritized subjectively.
      </p>
      <p>
        <strong className="text-white">What Solvren is not.</strong> Solvren is not a financial system of record, a data
        warehouse replacement, or a tool that requires broad access to raw customer data. Solvren works on metadata,
        events, derived impact, and minimized signals wherever possible.
      </p>
      <p>
        <strong className="text-white">Deep dives.</strong> Explore the{" "}
        <Link href="/platform/executive-risk-engine" className="text-cyan-300 underline hover:text-cyan-200">
          Executive Risk Engine
        </Link>{" "}
        for leadership visibility, the{" "}
        <Link href="/platform/approvals" className="text-cyan-300 underline hover:text-cyan-200">
          Approvals &amp; Readiness
        </Link>{" "}
        surface for operational control, and{" "}
        <Link href="/platform/integrations" className="text-cyan-300 underline hover:text-cyan-200">
          Integrations
        </Link>{" "}
        for how Solvren connects to your stack with minimal permissions and clear boundaries.
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
