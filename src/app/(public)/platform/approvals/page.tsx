import type { Metadata } from "next";
import Link from "next/link";
import { MarketingArticle } from "@/components/marketing/MarketingArticle";

export const metadata: Metadata = {
  title: "Approvals & Readiness",
  description: "Structured approvals, evidence, readiness checks, and auditability for revenue-impacting change.",
};

export default function PlatformApprovalsPage() {
  return (
    <MarketingArticle
      title="Approvals & Readiness"
      intro="Move revenue-impacting work through the right evidence, approvals, and readiness checks before it creates risk in production."
    >
      <p>
        Solvren helps teams govern the moments where operational change can affect revenue: pricing updates, payment
        flows, CRM automations, scheduling handoffs, launch readiness, and other workflows where informal coordination
        can become expensive. The platform makes required evidence, accountable owners, and approval state visible in one
        place.
      </p>
      <p>
        Approvals are designed to be practical, not bureaucratic. Solvren can route requests through the channels teams
        already use, preserve the audit trail, and show exactly what is blocked, what is ready, and what needs attention
        before a change proceeds.
      </p>
      <p>
        <strong className="text-white">Enterprise-grade governance.</strong> Evidence requirements, role-based approval
        expectations, readiness signals, and resolution history are captured so teams can prove what happened later—not
        reconstruct it from Slack threads and ticket comments.
      </p>
      <p>
        <strong className="text-white">Safe by default.</strong> Solvren does not modify connected systems unless
        write-back is explicitly enabled and governed. Approval workflows can begin in read-only mode while the
        organization validates value and access boundaries.
      </p>
      <p>
        Pair this with the{" "}
        <Link href="/platform/executive-risk-engine" className="text-cyan-300 underline hover:text-cyan-200">
          Executive Risk Engine
        </Link>{" "}
        for portfolio-level visibility.
      </p>
    </MarketingArticle>
  );
}
