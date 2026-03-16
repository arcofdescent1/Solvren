import type { Metadata } from "next";
import { PricingPage } from "@/components/marketing/pages/PricingPage";

export const metadata: Metadata = {
  title: "Pricing",
  description: "Solvren pricing and beta access for revenue change governance.",
};

export default function Page() {
  return <PricingPage noShell />;
}
