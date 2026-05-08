import type { Metadata } from "next";
import Link from "next/link";
import { MarketingArticle } from "@/components/marketing/MarketingArticle";

export const metadata: Metadata = {
  title: "Integrations",
  description: "Privacy-first integrations that connect Solvren to revenue and operations systems with minimal permissions.",
};

/**
 * Marketing integrations overview. Authenticated integration management remains at `/integrations` (app hub).
 */
export default function PlatformIntegrationsMarketingPage() {
  return (
    <MarketingArticle
      title="Integrations"
      intro="Connect Solvren to your revenue and operations stack with minimal permissions, transparent scopes, and read-only behavior by default."
    >
      <p>
        Solvren is designed to use system signals and operational metadata rather than replicate your systems of record.
        Typical integrations include CRM, billing, scheduling, chat, issue tracking, identity, and reporting systems—used
        to detect risk, coordinate action, and verify outcomes.
      </p>
      <p>
        <strong className="text-white">Privacy-first connection model.</strong> Integration payloads should be
        classified, minimized, redacted, or normalized before persistence. Credentials are handled through protected
        server-side flows, and connected systems remain read-only unless write-back is explicitly enabled by authorized
        administrators.
      </p>
      <p>
        <strong className="text-white">What customers should expect.</strong> Clear scope explanations, no raw payload
        storage by default, no plaintext credential exposure, and auditability around sensitive integration behavior.
        Expanded insights can be enabled intentionally when there is a business case and appropriate governance.
      </p>
      <p>
        For the latest connector list and setup steps, see{" "}
        <Link href="/docs" className="text-cyan-300 underline hover:text-cyan-200">
          documentation
        </Link>
        . To discuss enterprise requirements,{" "}
        <Link href="/contact" className="text-cyan-300 underline hover:text-cyan-200">
          contact us
        </Link>
        . If you already use Solvren, open the{" "}
        <Link href="/integrations" className="text-cyan-300 underline hover:text-cyan-200">
          integrations hub
        </Link>{" "}
        in your workspace.
      </p>
    </MarketingArticle>
  );
}
