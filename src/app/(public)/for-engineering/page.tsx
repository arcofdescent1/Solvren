import type { Metadata } from "next";
import { EngineeringPage } from "@/components/marketing/pages/EngineeringPage";

export const metadata: Metadata = {
  title: "For Engineering",
  description: "Solvren for engineering teams.",
};

export default function Page() {
  return <EngineeringPage noShell />;
}
