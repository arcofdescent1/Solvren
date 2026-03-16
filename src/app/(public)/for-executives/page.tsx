import type { Metadata } from "next";
import { ExecutivesPage } from "@/components/marketing/pages/ExecutivesPage";

export const metadata: Metadata = {
  title: "For Executives",
  description: "Solvren for executives.",
};

export default function Page() {
  return <ExecutivesPage noShell />;
}
