import type { Metadata } from "next";
import Link from "next/link";
import { SimpleLegalPage } from "@/components/legal/SimpleLegalPage";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How Solvren collects, uses, minimizes, and protects personal and customer data.",
};

export default function PrivacyPolicyPage() {
  return (
    <SimpleLegalPage title="Privacy Policy">
      <p>
        This Privacy Policy describes how Solvren, Inc. (“Solvren,” “we,” “us”) handles information in connection with
        our websites and services. It is provided for transparency and will be updated as our product, contractual
        commitments, and legal obligations evolve. For specific contractual terms, refer to your agreement with Solvren.
      </p>
      <p>
        <strong className="text-white">Privacy-first product design.</strong> Solvren is designed to operate on system
        signals, metadata, minimized identifiers, and derived operational impact rather than broad replication of source-
        of-truth customer or financial data. Where feasible, sensitive values are redacted, hashed, minimized, or avoided.
      </p>
      <p>
        <strong className="text-white">Information we process.</strong> We process account and authentication data you
        provide, usage and technical data needed to operate and secure the service, and customer-configured operational
        content such as change records, approvals, integration metadata, and signals from systems you connect.
      </p>
      <p>
        <strong className="text-white">How we use information.</strong> We use information to provide, secure, support,
        and improve the service; detect operational risk; coordinate workflows; communicate with customers; comply with
        legal obligations; and enforce agreements. We do not sell personal information.
      </p>
      <p>
        <strong className="text-white">Customer data and integrations.</strong> Customers control which integrations are
        enabled and what configuration is applied. Solvren’s architecture is intended to minimize stored customer-sourced
        payloads and protect credentials through server-side controls. Integration behavior may vary by plan, provider,
        and configuration.
      </p>
      <p>
        <strong className="text-white">Sharing.</strong> We share data with subprocessors that help us run the service,
        when required by law, or with your direction, such as integrations you enable. A current list of key subprocessors
        may be described in our Trust and security materials or contractual documentation.
      </p>
      <p>
        <strong className="text-white">Retention.</strong> We retain information for as long as needed to provide the
        service, comply with law, resolve disputes, enforce agreements, and maintain security. Retention details may be
        governed by your contract, organization settings, and product capabilities.
      </p>
      <p>
        <strong className="text-white">Your rights.</strong> Depending on your location, you may have rights to access,
        correct, delete, or object to certain processing. Contact us using the details on our Contact page to make a
        request.
      </p>
      <p>
        <strong className="text-white">Contact.</strong> Questions about this policy can be directed through{" "}
        <Link href="/contact" className="text-cyan-300 underline hover:text-cyan-200">
          our contact page
        </Link>
        .
      </p>
    </SimpleLegalPage>
  );
}
