import type { Metadata } from "next";
import { FinancePage } from "@/components/marketing/pages/FinancePage";

export const metadata: Metadata = {
  title: "For Finance & RevOps",
  description: "Solvren for finance and RevOps teams.",
};

export default function Page() {
  return <FinancePage noShell />;
}
