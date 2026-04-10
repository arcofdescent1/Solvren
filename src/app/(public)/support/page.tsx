import type { Metadata } from "next";
import Link from "next/link";
import { MarketingArticle } from "@/components/marketing/MarketingArticle";

export const metadata: Metadata = {
  title: "Support",
  description: "Help and support for Solvren customers.",
};

export default function SupportPage() {
  return (
    <MarketingArticle
      title="Support"
      intro="Solvren customers receive support through channels defined in their agreement. This page summarizes self-service resources available to all visitors."
    >
      <p>
        <strong className="text-white">Documentation.</strong> Product setup, guides, and security references live in{" "}
        <Link href="/docs" className="text-cyan-300 underline hover:text-cyan-200">
          Solvren Docs
        </Link>
        .
      </p>
      <p>
        <strong className="text-white">Trust and security.</strong> Review the{" "}
        <Link href="/trust" className="text-cyan-300 underline hover:text-cyan-200">
          Trust Center
        </Link>{" "}
        and{" "}
        <Link href="/security" className="text-cyan-300 underline hover:text-cyan-200">
          Security
        </Link>{" "}
        pages for control summaries and disclosure practices.
      </p>
      <p>
        <strong className="text-white">Contact.</strong> For sales or general questions, use{" "}
        <Link href="/contact" className="text-cyan-300 underline hover:text-cyan-200">
          Contact
        </Link>
        . Authenticated users should use in-app help or the escalation path provided by their organization administrator.
      </p>
    </MarketingArticle>
  );
}
