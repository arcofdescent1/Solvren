import type { Metadata } from "next";
import { MarketingArticle } from "@/components/marketing/MarketingArticle";

export const metadata: Metadata = {
  title: "About",
  description: "About Solvren and our mission for revenue protection.",
};

export default function AboutPage() {
  return (
    <MarketingArticle
      title="About Solvren"
      intro="Solvren helps organizations govern revenue-impacting change with structured intake, risk visibility, automated coordination, and measurable outcomes."
    >
      <p>
        We build for teams where billing, pricing, payments, and core revenue systems cannot afford ad hoc approvals
        and invisible risk. The platform connects to your toolchain, surfaces what matters to leadership, and preserves
        an audit trail when things go wrong.
      </p>
      <p>
        Solvren is developed by Solvren, Inc. We work with design partners and early customers to harden the product for
        enterprise security, scale, and operational reality.
      </p>
    </MarketingArticle>
  );
}
