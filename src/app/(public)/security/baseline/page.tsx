import type { Metadata } from "next";
import Link from "next/link";
import { MarketingArticle } from "@/components/marketing/MarketingArticle";

export const metadata: Metadata = {
  title: "Security baseline",
  description: "Solvren security baseline, ingestion minimization, and trust controls.",
};

export default function SecurityBaselinePage() {
  return (
    <MarketingArticle
      title="Solvren security baseline"
      intro="Solvren is designed as a risk intelligence and execution layer, not a source-of-truth financial system."
    >
      <p>
        Solvren minimizes sensitive data by default, storing operational signals, derived impact, and hashed identifiers
        rather than persisting unbounded raw source-of-truth payloads. Historical rows may exist under a phased
        migration with defined retention.
      </p>
      <p>
        Solvren is designed with HIPAA-ready architecture principles, SOC 2-aligned controls, and FedRAMP-informed
        security practices. We do not claim HIPAA compliance, FedRAMP authorization, or SOC 2 certification unless and
        until formally achieved.
      </p>
      <p>
        <strong className="text-white">Baseline controls include:</strong>
      </p>
      <ul className="list-disc space-y-2 pl-5 text-slate-300">
        <li>Data minimization by design (inbound integration payloads classified, redacted, and normalized at persistence)</li>
        <li>Tenant isolation through Supabase Row Level Security</li>
        <li>Role-based access control</li>
        <li>TLS encryption in transit</li>
        <li>Database encryption at rest through managed infrastructure</li>
        <li>Encrypted storage for sensitive credentials (in progress hardening)</li>
        <li>Automated secret scanning</li>
        <li>Restricted production debugging</li>
        <li>Security headers and Content-Security-Policy (measured hardening)</li>
        <li>Audit logging for sensitive administrative actions</li>
        <li>No default employee access to customer-sensitive data without authorization workflows planned</li>
      </ul>
      <p className="mt-6">
        <Link href="/security" className="text-cyan-300 underline hover:text-cyan-200">
          ← Security overview
        </Link>
      </p>
    </MarketingArticle>
  );
}
