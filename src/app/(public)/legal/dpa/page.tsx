import type { Metadata } from "next";
import Link from "next/link";
import { SimpleLegalPage } from "@/components/legal/SimpleLegalPage";

export const metadata: Metadata = {
  title: "Data Processing Addendum",
  description: "Data processing terms for Solvren customers, including minimization, security, and subprocessor commitments.",
};

export default function DpaPage() {
  return (
    <SimpleLegalPage title="Data Processing Addendum">
      <p>
        This Data Processing Addendum (“DPA”) describes how Solvren processes personal data on behalf of customers who
        use the service in a business capacity. It is intended to align with common expectations under privacy
        regulations when Solvren acts as a processor. Your master subscription agreement or order form may incorporate
        this DPA by reference or include a superseding data protection exhibit.
      </p>
      <p>
        <strong className="text-white">Roles.</strong> For customer-submitted personal data processed to provide the
        service, the customer is typically the controller and Solvren is the processor. Solvren may act as a controller
        for limited operational data such as account, billing, security, and service administration information.
      </p>
      <p>
        <strong className="text-white">Processing instructions.</strong> Solvren processes personal data only on
        documented instructions from the customer, including through configuration of the product, organization settings,
        and integrations the customer enables.
      </p>
      <p>
        <strong className="text-white">Data minimization.</strong> Solvren is designed to process operational signals,
        metadata, minimized identifiers, and derived impact rather than unnecessary source-of-truth payloads. Where
        feasible, personal data is redacted, hashed, minimized, or avoided before persistence.
      </p>
      <p>
        <strong className="text-white">Security measures.</strong> Solvren implements technical and organizational
        measures appropriate to the risk, including access controls, tenant isolation, encryption in transit, managed
        encryption at rest, credential protection, audit logging, and internal access governance as summarized in our
        Security and Trust materials.
      </p>
      <p>
        <strong className="text-white">Subprocessors.</strong> The customer authorizes Solvren to engage subprocessors
        subject to data protection obligations appropriate to the services they provide. Customers will be notified of
        material subprocessor changes as described in the agreement or product notices.
      </p>
      <p>
        <strong className="text-white">Assistance.</strong> Solvren assists customers, taking into account the nature of
        processing, with responding to data subject requests, security inquiries, and impact assessments where required
        by law and contract.
      </p>
      <p>
        <strong className="text-white">Deletion and return.</strong> Upon termination of services, Solvren deletes or
        returns personal data in accordance with the agreement and product capabilities, subject to legal retention,
        security, backup, and dispute-resolution requirements.
      </p>
      <p>
        For a countersigned DPA or enterprise-specific terms, contact your Solvren representative or use{" "}
        <Link href="/contact" className="text-cyan-300 underline hover:text-cyan-200">
          our contact page
        </Link>
        .
      </p>
    </SimpleLegalPage>
  );
}
