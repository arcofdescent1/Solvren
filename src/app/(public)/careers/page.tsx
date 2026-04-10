import type { Metadata } from "next";
import Link from "next/link";
import { MarketingArticle } from "@/components/marketing/MarketingArticle";

export const metadata: Metadata = {
  title: "Careers",
  description: "Careers at Solvren.",
};

export default function CareersPage() {
  return (
    <MarketingArticle
      title="Careers"
      intro="We are building a focused team across product, engineering, and go-to-market. Open roles will be posted here as we grow."
    >
      <p>
        Interested in working on revenue protection, enterprise workflows, and trustworthy automation? Send a brief note
        and resume or profile link to{" "}
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
