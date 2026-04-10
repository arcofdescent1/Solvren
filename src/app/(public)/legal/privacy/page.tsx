import type { Metadata } from "next";
import Link from "next/link";
import { SimpleLegalPage } from "@/components/legal/SimpleLegalPage";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How Solvren collects, uses, and protects personal and customer data.",
};

export default function PrivacyPolicyPage() {
  return (
    <SimpleLegalPage title="Privacy Policy">
      <p>
        This Privacy Policy describes how Solvren, Inc. (“Solvren,” “we,” “us”) handles information in connection with
        our websites and services. It is provided for transparency and will be updated as our product and legal
        obligations evolve. For specific contractual terms, refer to your agreement with Solvren.
      </p>
      <p>
        <strong className="text-white">Information we process.</strong> We process account and authentication data you
        provide, usage and technical data needed to operate the service (such as logs and device information), and
        content you submit through the product (for example, change records, approvals, and integrations you connect).
      </p>
      <p>
        <strong className="text-white">How we use information.</strong> We use this information to provide and improve
        the service, secure the platform, support customers, meet legal obligations, and communicate about the product.
        We do not sell personal information.
      </p>
      <p>
        <strong className="text-white">Sharing.</strong> We share data with subprocessors that help us run the service
        (such as hosting and email), when required by law, or with your direction (for example, integrations you enable).
        A current list of key subprocessors is described in our Trust and security materials.
      </p>
      <p>
        <strong className="text-white">Retention.</strong> We retain information for as long as needed to provide the
        service, comply with law, resolve disputes, and enforce agreements. Retention details may be governed by your
        contract and organization settings.
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
