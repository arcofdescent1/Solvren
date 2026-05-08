import type { Metadata } from "next";
import { SimpleLegalPage } from "@/components/legal/SimpleLegalPage";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "Terms governing use of Solvren websites and services.",
};

export default function TermsOfServicePage() {
  return (
    <SimpleLegalPage title="Terms of Service">
      <p>
        These Terms of Service (“Terms”) govern access to Solvren’s websites and services operated by Solvren, Inc.
        By using the service, you agree to these Terms. If you are using Solvren on behalf of an organization, you
        represent that you have authority to bind that organization.
      </p>
      <p>
        <strong className="text-white">The service.</strong> Solvren provides software and related services for revenue
        risk intelligence, operational governance, approvals, integration monitoring, and execution workflows. Features,
        integrations, and availability may change as the product evolves.
      </p>
      <p>
        <strong className="text-white">Accounts and acceptable use.</strong> You are responsible for account
        credentials, users you authorize, and activity under your account. You agree not to misuse the service, attempt
        unauthorized access, bypass security controls, interfere with availability, or use the service in violation of law
        or third-party rights.
      </p>
      <p>
        <strong className="text-white">Customer data.</strong> You retain rights in data you submit or configure for use
        with the service. You grant Solvren the rights needed to host, process, secure, support, and display that data to
        provide the service. Solvren is designed to minimize sensitive customer-sourced data where feasible, but customer
        configuration and enabled integrations may affect what information is processed.
      </p>
      <p>
        <strong className="text-white">Integrations and write-back.</strong> Customers are responsible for integrations
        they enable and permissions they authorize. Solvren is designed to support read-only integration patterns by
        default, with write-back behavior requiring explicit enablement where available.
      </p>
      <p>
        <strong className="text-white">Security.</strong> Solvren implements technical and organizational measures
        designed to protect the service. No system can be guaranteed completely secure, and customers remain responsible
        for managing their own users, systems, permissions, and connected accounts.
      </p>
      <p>
        <strong className="text-white">Disclaimers.</strong> The service is provided on an “as is” basis to the extent
        permitted by law. Solvren does not guarantee uninterrupted or error-free operation. Estimated revenue impact,
        risk scores, and recommendations are operational decision-support outputs and are not audited financial measures.
      </p>
      <p>
        <strong className="text-white">Limitation of liability.</strong> To the maximum extent permitted by applicable
        law, Solvren’s aggregate liability arising out of these Terms is limited as set forth in your governing
        agreement, or where no separate agreement exists, to the fees paid by you for the service in the twelve months
        preceding the claim.
      </p>
      <p>
        <strong className="text-white">Governing law.</strong> Governing law and venue for disputes will be specified
        in your enterprise agreement where applicable. Otherwise, disputes are subject to the laws and courts of the
        State of Delaware, excluding conflict-of-law rules.
      </p>
      <p>
        <strong className="text-white">Changes.</strong> We may update these Terms. We will provide notice of material
        changes as appropriate. Continued use after changes constitutes acceptance.
      </p>
    </SimpleLegalPage>
  );
}
