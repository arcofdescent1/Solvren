import type { Metadata } from "next";
import Link from "next/link";
import { MarketingArticle } from "@/components/marketing/MarketingArticle";

export const metadata: Metadata = {
  title: "Careers",
  description: "Careers at Solvren building privacy-first revenue risk intelligence for enterprise teams.",
};

export default function CareersPage() {
  return (
    <MarketingArticle
      title="Careers"
      intro="We are building a focused team to create enterprise-grade systems for revenue risk intelligence, operational governance, and privacy-first automation."
    >
      <p>
        Solvren is for people who care about building serious software: clear architecture, strong security posture,
        practical workflows, and measurable business outcomes. We are especially interested in builders who understand
        that enterprise trust is earned through thoughtful product decisions, not slogans.
      </p>
      <p>
        Interested in working on data minimization, integration safety, approvals, executive risk visibility, and
        trustworthy automation? Send a brief note and resume or profile link to{" "}
        <a href="mailto:careers@solvren.com" className="text-cyan-300 underline hover:text-cyan-200">
          careers@solvren.com
        </a>
        . We read every message.
      </p>
      <p>
        For other inquiries, use the{" "}
        <Link href="/contact" className="text-cyan-300 underline hover:text-cyan-200">
          contact page
        </Link>
        .
      </p>
    </MarketingArticle>
  );
}
