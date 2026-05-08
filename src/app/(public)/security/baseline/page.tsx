import type { Metadata } from "next";
import Link from "next/link";
import { MarketingArticle } from "@/components/marketing/MarketingArticle";

export const metadata: Metadata = {
  title: "Security Baseline",
  description: "Solvren security baseline, data minimization, encryption, access governance, and trust controls.",
};

export default function SecurityBaselinePage() {
  return (
    <MarketingArticle
      title="Solvren security baseline"
      intro="Solvren is designed as a risk intelligence and execution layer—not a source-of-truth financial system or customer data warehouse."
    >
      <p>
        Solvren is built around a simple security principle: collect less, store less, expose less. The platform is
        intended to operate on operational signals, metadata, derived impact, and minimized identifiers rather than
        broad replication of sensitive customer, financial, or source-system records.
      </p>
      <p>
        Solvren is designed with HIPAA-ready architecture principles, SOC 2-aligned controls, HITRUST-aligned access
        governance direction, and FedRAMP-informed security practices. We do not claim HIPAA compliance, HITRUST
        certification, FedRAMP authorization, or SOC 2 certification unless and until formally achieved.
      </p>
      <p>
        <strong className="text-white">Baseline controls include:</strong>
      </p>
      <ul className="list-disc space-y-2 pl-5 text-slate-200">
        <li>Data minimization by design for inbound integration payloads</li>
        <li>Classification, redaction, normalization, and minimized persistence for customer-sourced signals</li>
        <li>Tenant isolation through Supabase Row Level Security and server-side authorization checks</li>
        <li>Role-based access control for organization, approval, and administrative workflows</li>
        <li>TLS encryption in transit and managed database encryption at rest</li>
        <li>Encrypted storage for sensitive credentials with continued hardening toward envelope encryption and key rotation</li>
        <li>Secret scanning, restricted production debugging, and measured Content-Security-Policy hardening</li>
        <li>Audit logging for sensitive administrative, integration, and access-control actions</li>
        <li>Customer-controlled support access patterns so employee access to sensitive data is not available by default</li>
        <li>Read-only integrations by default, with explicit governance required before write-back behavior is enabled</li>
      </ul>
      <p>
        <strong className="text-white">Data boundary.</strong> Solvren is intended to process signals and events from
        connected systems, not become a duplicate system of record. Historical rows may exist under phased migrations
        and defined retention policies as the platform continues to harden its minimized data model.
      </p>
      <p className="mt-6">
        <Link href="/security" className="text-cyan-300 underline hover:text-cyan-200">
          ← Security overview
        </Link>
      </p>
    </MarketingArticle>
  );
}
