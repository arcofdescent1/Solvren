import type { Metadata } from "next";
import Link from "next/link";
import { MarketingArticle } from "@/components/marketing/MarketingArticle";

export const metadata: Metadata = {
  title: "Contact",
  description: "Contact Solvren for sales, support, and general inquiries.",
};

export default function ContactPage() {
  return (
    <MarketingArticle
      title="Contact Solvren"
      intro="Reach out for sales conversations, partnership inquiries, or general questions about the platform."
    >
      <p>
        <strong className="text-white">Sales and enterprise.</strong> Email{" "}
        <a href="mailto:sales@solvren.com" className="text-cyan-300 underline hover:text-cyan-200">
          sales@solvren.com
        </a>{" "}
        or mention your timeline, team size, and primary revenue systems so we can route your message appropriately.
      </p>
      <p>
        <strong className="text-white">Security.</strong> For vulnerability reports, use the{" "}
        <Link href="/security/responsible-disclosure" className="text-cyan-300 underline hover:text-cyan-200">
          responsible disclosure
        </Link>{" "}
        process.
      </p>
      <p>
        <strong className="text-white">Existing customers.</strong> Product support paths are described on the{" "}
        <Link href="/support" className="text-cyan-300 underline hover:text-cyan-200">
          Support
        </Link>{" "}
        page.
      </p>
    </MarketingArticle>
  );
}
