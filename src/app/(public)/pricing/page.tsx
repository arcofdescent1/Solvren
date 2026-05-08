import type { Metadata } from "next";
import { PricingPage } from "@/components/marketing/pages/PricingPage";

export const metadata: Metadata = {
  title: "Pricing",
  description: "Solvren pricing for privacy-first revenue risk intelligence, approvals, integrations, and enterprise governance.",
};

export default function Page() {
  return <PricingPage noShell />;
}
