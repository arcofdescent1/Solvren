import type { Metadata } from "next";
import Link from "next/link";
import { MarketingArticle } from "@/components/marketing/MarketingArticle";

export const metadata: Metadata = {
  title: "Contact",
  description: "Contact Solvren for sales, security, support, and enterprise inquiries.",
};

export default function ContactPage() {
  return (
    <MarketingArticle
      title="Contact Solvren"
      intro="Talk with us about revenue risk intelligence, privacy-first integrations, enterprise readiness, or how Solvren can fit into your operating environment."
    >
      <p>
        <strong className="text-white">Sales and enterprise.</strong> Email{" "}
        <a href="mailto:sales@solvren.com" className="text-cyan-300 underline hover:text-cyan-200">
          sales@solvren.com
        </a>{" "}
        with your timeline, team size, primary revenue systems, and the operational risks you want to reduce. We can help
        you evaluate a minimal-data starting point, integration scope, security requirements, and rollout path.
      </p>
      <p>
        <strong className="text-white">Security and trust.</strong> For security architecture questions, review the{" "}
        <Link href="/security/baseline" className="text-cyan-300 underline hover:text-cyan-200">
          Security Baseline
        </Link>
        . For vulnerability reports, use the{" "}
        <Link href="/security/responsible-disclosure" className="text-cyan-300 underline hover:text-cyan-200">
          Responsible Disclosure
        </Link>{" "}
        process.
      </p>
      <p>
        <strong className="text-white">Existing customers.</strong> Product support paths are described on the{" "}
        <Link href="/support" className="text-cyan-300 underline hover:text-cyan-200">
          Support
        </Link>{" "}
        page. Customer-specific support access is governed through the controls available in your workspace and
        agreement.
      </p>
    </MarketingArticle>
  );
}
