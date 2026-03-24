"use client";

/**
 * Trust Center — exact copy + structure for Solvren.
 * Clear, serious, low-drama. Enterprise-ready trust page.
 */
import * as React from "react";
import Link from "next/link";
import {
  LockKeyhole,
  Database,
  ChevronDown,
  Layers2,
  Shield,
  FileCheck,
  ServerCog,
} from "lucide-react";
import { PublicHeader } from "@/components/marketing/PublicHeader";
import { PublicFooter } from "@/components/marketing/PublicFooter";
import { Button } from "@/ui";
import { TrustSecurityRequestForm } from "./TrustSecurityRequestForm";

const SECURITY_EMAIL = "security@solvren.com";

const TRUST_TILES = [
  {
    title: "Tenant Isolation",
    body: "Customer data is logically isolated at the database layer with organization-scoped access controls.",
  },
  {
    title: "Role-Based Access",
    body: "Permissions are enforced by user role and organization context to limit access to only what is needed.",
  },
  {
    title: "Encryption",
    body: "Data is protected in transit and at rest, with additional safeguards for sensitive credentials and integration secrets.",
  },
  {
    title: "Auditability",
    body: "Security-relevant actions and privileged operations are logged to support traceability and review.",
  },
  {
    title: "Operational Resilience",
    body: "Backup, recovery, monitoring, and alerting processes are in place to support platform reliability.",
  },
  {
    title: "SOC-Ready Controls",
    body: "Solvren is being operated with documented controls, policies, and evidence practices aligned to a SOC-ready posture.",
  },
];

const PRINCIPLES = [
  { title: "Least privilege by default", body: "Access should be limited by user role, organization scope, and the minimum permissions required to do the job." },
  { title: "Tenant isolation is non-negotiable", body: "Organizations should only be able to access their own data. Isolation is enforced through database-level controls and application-level authorization." },
  { title: "Sensitive actions must be traceable", body: "Security-relevant and privileged actions should leave an auditable trail." },
  { title: "Controls should be operational, not aspirational", body: "Policies, reviews, backups, monitoring, and incident response only matter if they are actively run and maintained." },
  { title: "Trust should reduce friction, not create it", body: "We aim to give customers clear answers, practical safeguards, and transparency without unnecessary complexity." },
];

const PLATFORM_BULLETS = [
  "Authenticated access required for protected application surfaces",
  "Organization-scoped authorization for customer data and actions",
  "Role-based access control for user permissions",
  "Database row-level security for tenant isolation",
  "Controlled privileged access for administrative and backend operations",
  "Audit logging for security-relevant activity",
];

const ACCESS_BLOCKS = [
  { title: "Role-based permissions", body: "Users are granted access based on role and responsibility, not broad administrative defaults." },
  { title: "Organization-scoped access", body: "Users operate within the context of organizations they belong to. Access outside authorized organization scope is blocked." },
  { title: "Privileged access controls", body: "Elevated or privileged operations are restricted, reviewed, and auditable." },
  { title: "Access review practices", body: "Administrative and production access are reviewed on a recurring basis as part of our operating controls." },
];

const INFRA_LEFT = [
  "Modern web application architecture",
  "Managed cloud hosting",
  "Managed database and platform services",
  "Secure environment variable and secrets handling",
  "Version-controlled application and schema changes",
];

const INFRA_RIGHT = [
  "Production deployment controls",
  "Environment separation",
  "Health checks and alerting",
  "Backup and restore procedures",
  "Controlled administrative operations",
];

const MONITORING_ITEMS = [
  "Structured application and operational logging",
  "Alerting for critical failures and abnormal conditions",
  "Health checks for core service availability",
  "Defined incident response workflow and severity levels",
  "Post-incident review and follow-up tracking",
];

const FAQ_ITEMS = [
  {
    q: "How does Solvren isolate customer data?",
    a: "Solvren uses organization-scoped authorization and database-level tenant isolation controls so customers can access only their own authorized data.",
  },
  {
    q: "Does Solvren use role-based access control?",
    a: "Yes. Access to application functionality and sensitive operations is limited by role and organization context.",
  },
  {
    q: "How are integrations handled securely?",
    a: "Integrations are handled through controlled server-side flows and protected credential storage patterns intended to reduce exposure and support auditability.",
  },
  {
    q: "Is Solvren SOC 2 certified?",
    a: "Solvren is being operated with documented controls, policies, and evidence practices aligned to a SOC-ready posture. Formal certification status should always be represented accurately based on current state.",
  },
  {
    q: "Can Solvren support enterprise security review?",
    a: "Yes. We are building the platform and operating model to support enterprise trust review, including access controls, auditability, lifecycle controls, and operational safeguards.",
  },
];

function SectionFrame({
  eyebrow,
  title,
  children,
  className = "",
}: {
  eyebrow?: string;
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`py-16 ${className}`}>
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        {eyebrow && (
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-400/90 mb-2">{eyebrow}</p>
        )}
        <h2 className="text-2xl font-bold text-white sm:text-3xl">{title}</h2>
        <div className="mt-6 text-slate-300 space-y-4">{children}</div>
      </div>
    </section>
  );
}

function FaqItem({ question, answer }: { question: string; answer: string }) {
  return (
    <details className="group border-b border-white/10">
      <summary className="flex cursor-pointer list-none items-center justify-between py-4 text-left font-medium text-white hover:text-cyan-200 transition-colors [&::-webkit-details-marker]:hidden">
        {question}
        <ChevronDown className="h-5 w-5 shrink-0 text-slate-400 transition-transform group-open:rotate-180" />
      </summary>
      <div className="pb-4 text-slate-300">
        {answer}
      </div>
    </details>
  );
}

export function TrustCenterContent() {
  const [securityFormOpen, setSecurityFormOpen] = React.useState(false);

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <PublicHeader />
      <main>
        {/* 1. Hero */}
        <section className="relative overflow-hidden border-b border-white/10">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(34,211,238,0.12),_transparent_40%),linear-gradient(180deg,_rgba(15,23,42,0.6),_transparent)]" />
          <div className="relative mx-auto max-w-4xl px-4 py-20 sm:px-6 lg:px-8 lg:py-24">
            <p className="text-xs font-semibold uppercase tracking-[0.26em] text-cyan-400/90 mb-4">Trust Center</p>
            <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl lg:text-6xl">
              Security, privacy, and reliability built for business-critical operations
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">
              Solvren is designed to help organizations detect, prioritize, and resolve revenue-impacting operational issues across core systems. Because Solvren sits close to sensitive workflows and business data, security and trust are foundational to how the platform is built and operated.
            </p>
            <div className="mt-10 flex flex-wrap items-center gap-3">
              <Button
                size="lg"
                className="bg-white text-slate-950 hover:bg-slate-100"
                onClick={() => setSecurityFormOpen(true)}
              >
                Request security information
              </Button>
              <Link href={`mailto:${SECURITY_EMAIL}`}>
                <Button size="lg" variant="outline" className="border-white/20 text-white hover:bg-white/10">
                  Contact our team
                </Button>
              </Link>
            </div>
            <p className="mt-8 max-w-2xl text-sm text-slate-400">
              We operate with a security-first architecture, tenant isolation, role-based access controls, auditability, and documented operational safeguards designed to support enterprise trust requirements.
            </p>
          </div>
        </section>

        {/* 2. Trust overview tiles */}
        <section className="border-b border-white/10 bg-white/[0.02] py-16">
          <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
            <h2 className="text-2xl font-bold text-white">Trust at a glance</h2>
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {TRUST_TILES.map((tile) => (
                <div
                  key={tile.title}
                  className="rounded-xl border border-white/10 bg-white/5 p-6"
                >
                  <h3 className="font-semibold text-white">{tile.title}</h3>
                  <p className="mt-2 text-sm text-slate-300">{tile.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 3. Security principles */}
        <SectionFrame
          title="How we think about trust"
          eyebrow="Security principles"
          className="border-b border-white/10"
        >
          <p>
            Solvren is built for environments where operational breakdowns can have real financial and customer impact. That means trust cannot be treated as an afterthought. Our security posture is built around a few core principles:
          </p>
          <ul className="space-y-4 mt-6">
            {PRINCIPLES.map((p) => (
              <li key={p.title} className="flex gap-3">
                <Shield className="mt-1 h-5 w-5 shrink-0 text-cyan-400/80" />
                <div>
                  <strong className="text-white">{p.title}</strong>
                  <p className="mt-1 text-slate-300">{p.body}</p>
                </div>
              </li>
            ))}
          </ul>
        </SectionFrame>

        {/* 4. Platform security */}
        <SectionFrame
          title="Platform security"
          eyebrow="Platform"
          className="border-b border-white/10 bg-white/[0.02]"
        >
          <p>
            Solvren uses authenticated access, organization-scoped authorization, and database-level tenant isolation to protect customer data and workflows.
          </p>
          <ul className="list-disc list-inside space-y-2 mt-4 text-slate-300">
            {PLATFORM_BULLETS.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
          <p className="mt-6 text-slate-300">
            This layered model is intended to ensure that access depends on who the user is, which organization they belong to, and what they are permitted to do within that organization.
          </p>
        </SectionFrame>

        {/* 5. Data protection */}
        <SectionFrame
          title="Data protection"
          eyebrow="Data"
          className="border-b border-white/10"
        >
          <p>
            We treat the protection of customer and operational data as a core platform responsibility.
          </p>
          <div className="mt-6 grid gap-6 sm:grid-cols-2">
            <div className="rounded-xl border border-white/10 bg-white/5 p-6">
              <h4 className="font-semibold text-white flex items-center gap-2">
                <LockKeyhole className="h-4 w-4 text-cyan-400/80" />
                Encryption in transit and at rest
              </h4>
              <p className="mt-2 text-sm text-slate-300">
                Data is protected in transit using HTTPS/TLS. Platform data and stored assets are protected at rest through infrastructure-level encryption controls.
              </p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-6">
              <h4 className="font-semibold text-white flex items-center gap-2">
                <Shield className="h-4 w-4 text-cyan-400/80" />
                Protected integration credentials
              </h4>
              <p className="mt-2 text-sm text-slate-300">
                Integration tokens and other sensitive credentials are handled through server-side controls and protected storage patterns designed to reduce exposure risk.
              </p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-6 sm:col-span-2">
              <h4 className="font-semibold text-white flex items-center gap-2">
                <Database className="h-4 w-4 text-cyan-400/80" />
                Data minimization and controlled retention
              </h4>
              <p className="mt-2 text-sm text-slate-300">
                We aim to collect and retain only the data needed to operate the platform and support customer workflows. Retention and deletion controls are being structured to support enterprise data lifecycle expectations.
              </p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-6 sm:col-span-2">
              <h4 className="font-semibold text-white flex items-center gap-2">
                <FileCheck className="h-4 w-4 text-cyan-400/80" />
                Deletion and lifecycle support
              </h4>
              <p className="mt-2 text-sm text-slate-300">
                Solvren is being built with data lifecycle controls that support customer offboarding, deletion workflows, and retention governance.
              </p>
            </div>
          </div>
        </SectionFrame>

        {/* 6. Access control */}
        <SectionFrame
          title="Access control"
          eyebrow="Access"
          className="border-b border-white/10 bg-white/[0.02]"
        >
          <p>
            Solvren uses layered access controls to reduce unnecessary exposure and keep customer operations appropriately scoped.
          </p>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {ACCESS_BLOCKS.map((b) => (
              <div key={b.title} className="rounded-xl border border-white/10 bg-white/5 p-5">
                <h4 className="font-semibold text-white">{b.title}</h4>
                <p className="mt-2 text-sm text-slate-300">{b.body}</p>
              </div>
            ))}
          </div>
        </SectionFrame>

        {/* 7. Infrastructure and hosting */}
        <SectionFrame
          title="Infrastructure and hosting"
          eyebrow="Infrastructure"
          className="border-b border-white/10"
        >
          <p>
            Solvren is built on a modern cloud architecture designed for secure application delivery, managed data services, and operational scalability.
          </p>
          <div className="mt-8 grid gap-8 sm:grid-cols-2">
            <div>
              <h4 className="font-semibold text-white flex items-center gap-2 mb-4">
                <Layers2 className="h-4 w-4 text-cyan-400/80" />
                Application and data platform
              </h4>
              <ul className="list-disc list-inside space-y-2 text-slate-300">
                {INFRA_LEFT.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-white flex items-center gap-2 mb-4">
                <ServerCog className="h-4 w-4 text-cyan-400/80" />
                Operational controls
              </h4>
              <ul className="list-disc list-inside space-y-2 text-slate-300">
                {INFRA_RIGHT.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </div>
        </SectionFrame>

        {/* 8. Monitoring and incident response */}
        <SectionFrame
          title="Monitoring and incident response"
          eyebrow="Operations"
          className="border-b border-white/10 bg-white/[0.02]"
        >
          <p>
            Solvren is operated with monitoring, logging, and response processes intended to detect operational issues quickly and support timely investigation and remediation.
          </p>
          <ul className="list-disc list-inside space-y-2 mt-4 text-slate-300">
            {MONITORING_ITEMS.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <p className="mt-6 text-slate-300">
            When issues occur, our goal is to contain impact quickly, restore service safely, and document follow-up actions clearly.
          </p>
        </SectionFrame>

        {/* 9. Subprocessors */}
        <SectionFrame
          title="Subprocessors and service providers"
          eyebrow="Vendors"
          className="border-b border-white/10"
        >
          <p>
            Like most modern software platforms, Solvren relies on a small number of trusted infrastructure and service providers to deliver the product securely and reliably.
          </p>
          <p className="mt-4 text-sm text-slate-400">
            A current subprocessor list is available upon request and will continue to evolve as the platform matures.
          </p>
        </SectionFrame>

        {/* 10. Security request CTA */}
        <section className="border-b border-white/10 bg-white/[0.02] py-16">
          <div className="mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8">
            <h2 className="text-2xl font-bold text-white">Need more information?</h2>
            <p className="mt-4 max-w-2xl mx-auto text-slate-300">
              We understand that security review is an important part of evaluating operational software. If your team needs additional information, we can provide further security documentation and discuss Solvren&apos;s control environment in more detail.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
              <Button
                size="lg"
                className="bg-white text-slate-950 hover:bg-slate-100"
                onClick={() => setSecurityFormOpen(true)}
              >
                Request security information
              </Button>
              <Link href={`mailto:${SECURITY_EMAIL}`}>
                <Button size="lg" variant="outline" className="border-white/20 text-white hover:bg-white/10">
                  Contact security team
                </Button>
              </Link>
            </div>
            <p className="mt-8 text-sm text-slate-400">
              For security and trust inquiries, contact:{" "}
              <a href={`mailto:${SECURITY_EMAIL}`} className="text-cyan-400 hover:underline">
                {SECURITY_EMAIL}
              </a>
            </p>
          </div>
        </section>

        {/* 11. FAQ */}
        <section className="py-16">
          <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
            <h2 className="text-2xl font-bold text-white">Frequently asked questions</h2>
            <div className="mt-8 divide-y-0">
              {FAQ_ITEMS.map((faq) => (
                <FaqItem key={faq.q} question={faq.q} answer={faq.a} />
              ))}
            </div>
          </div>
        </section>
      </main>
      <PublicFooter />

      <TrustSecurityRequestForm open={securityFormOpen} onOpenChange={setSecurityFormOpen} />
    </div>
  );
}
