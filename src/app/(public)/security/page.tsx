import type { Metadata } from "next";
import { SecurityPage } from "@/components/marketing/pages/SecurityPage";

export const metadata: Metadata = {
  title: "Security",
  description: "Solvren security, controls, and trust.",
};

export default function Page() {
  return <SecurityPage noShell />;
}
