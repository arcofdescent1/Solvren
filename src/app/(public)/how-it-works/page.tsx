import type { Metadata } from "next";
import { HowItWorksPage } from "@/components/marketing/pages/HowItWorksPage";

export const metadata: Metadata = {
  title: "How Solvren Works",
  description:
    "See how Solvren captures change context, coordinates safeguards automatically, analyzes financial risk, and routes reviews with complete visibility.",
};

export default function Page() {
  return <HowItWorksPage noShell />;
}
