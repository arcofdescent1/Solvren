import type { Metadata } from "next";
import Link from "next/link";
import { MarketingArticle } from "@/components/marketing/MarketingArticle";

export const metadata: Metadata = {
  title: "Responsible Disclosure",
  description: "How security researchers can responsibly report vulnerabilities to Solvren.",
};

export default function ResponsibleDisclosurePage() {
  return (
    <MarketingArticle
      title="Responsible disclosure"
      intro="Solvren values responsible security research and clear communication. If you believe you have found a vulnerability in a Solvren-controlled system, please report it through the process below."
    >
      <p>
        <strong className="text-white">Scope.</strong> Reports should concern Solvren-controlled websites, applications,
        APIs, or infrastructure. Please do not access customer data without authorization, disrupt production systems,
        perform destructive testing, attempt persistence, or conduct social engineering against Solvren personnel,
        customers, or partners.
      </p>
      <p>
        <strong className="text-white">How to report.</strong> Email{" "}
        <a href="mailto:security@solvren.com" className="text-cyan-300 underline hover:text-cyan-200">
          security@solvren.com
        </a>{" "}
        with a clear description, steps to reproduce, affected URLs or assets, expected impact, and any supporting
        evidence. Please minimize sensitive data in your report. If encryption is needed, we can provide a key on request.
      </p>
      <p>
        <strong className="text-white">What to expect.</strong> We aim to acknowledge valid reports promptly, investigate
        in good faith, and coordinate remediation based on severity and risk. We do not operate a public bug bounty
        program at this time, and compensation is not guaranteed.
      </p>
      <p>
        <strong className="text-white">Safe harbor intent.</strong> We will not pursue legal action against researchers
        who act in good faith, avoid privacy violations and service disruption, and follow this disclosure process.
      </p>
      <p>
        For general security and trust information, see the{" "}
        <Link href="/trust" className="text-cyan-300 underline hover:text-cyan-200">
          Trust Center
        </Link>{" "}
        and{" "}
        <Link href="/security/baseline" className="text-cyan-300 underline hover:text-cyan-200">
          Security Baseline
        </Link>
        .
      </p>
    </MarketingArticle>
  );
}
