import type { Metadata } from "next";
import { MarketingArticle } from "@/components/marketing/MarketingArticle";

export const metadata: Metadata = {
  title: "About",
  description: "About Solvren and our mission to protect revenue through privacy-first operational intelligence.",
};

export default function AboutPage() {
  return (
    <MarketingArticle
      title="About Solvren"
      intro="Solvren helps organizations detect and resolve revenue-impacting operational risk without turning sensitive business systems into another exposed data surface."
    >
      <p>
        Modern companies depend on dozens of connected systems to sell, schedule, bill, support, and deliver. When those
        workflows break, the impact is often invisible until revenue is missed, customers are frustrated, or executives
        are forced to chase answers across tickets, dashboards, and meetings.
      </p>
      <p>
        Solvren exists to close that gap. We turn system signals and operational metadata into prioritized issues,
        accountable ownership, structured approvals, and measurable outcomes. The platform is designed to help teams see
        what matters, act quickly, and verify that problems are actually resolved.
      </p>
      <p>
        <strong className="text-white">Our approach is privacy-first.</strong> Solvren is not intended to be a financial
        system of record or customer data warehouse. We design for data minimization, read-only integrations by default,
        redaction, encrypted credentials, tenant isolation, and customer-controlled access.
      </p>
      <p>
        Solvren is developed by Solvren, Inc. We work with design partners and early customers to harden the product for
        enterprise security, scale, and operational reality.
      </p>
    </MarketingArticle>
  );
}
