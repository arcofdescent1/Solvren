import type { Metadata } from "next";
import Link from "next/link";
import { MarketingArticle } from "@/components/marketing/MarketingArticle";

export const metadata: Metadata = {
  title: "Responsible Disclosure",
  description: "How security researchers can report vulnerabilities to Solvren.",
};

export default function ResponsibleDisclosurePage() {
  return (
    <MarketingArticle
      title="Responsible disclosure"
      intro="We take security seriously. If you believe you have found a vulnerability, please report it to us using the process below."
    >
      <p>
        <strong className="text-white">Scope.</strong> Reports should concern Solvren-controlled systems and services.
        Please do not access customer data without authorization, disrupt production systems, or perform social
        engineering against Solvren personnel or customers.
      </p>
      <p>
        <strong className="text-white">How to report.</strong> Email{" "}
        <a href="mailto:security@solvren.com" className="text-cyan-300 underline hover:text-cyan-200">
          security@solvren.com
        </a>{" "}
        with a clear description, steps to reproduce, and any supporting evidence. Encrypt sensitive details if needed;
        we can provide a key on request.
      </p>
      <p>
        <strong className="text-white">What to expect.</strong> We aim to acknowledge valid reports promptly and work
        with you on remediation timelines. We do not operate a public bug bounty program at this time.
      </p>
      <p>
        For general security and trust information, see the{" "}
        <Link href="/trust" className="text-cyan-300 underline hover:text-cyan-200">
          Trust Center
        </Link>{" "}
        and{" "}
        <Link href="/security" className="text-cyan-300 underline hover:text-cyan-200">
          Security overview
        </Link>
        .
      </p>
    </MarketingArticle>
  );
}
