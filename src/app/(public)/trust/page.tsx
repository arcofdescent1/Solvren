/**
 * Phase 4 — Trust Center (customer-facing).
 * Public page with security philosophy, controls, data handling, infrastructure, subprocessors, contact.
 */
import type { Metadata } from "next";
import { TrustCenterContent } from "@/components/trust/TrustCenterContent";

export const metadata: Metadata = {
  title: "Trust Center",
  description: "Solvren security, controls, data protection, and trust.",
};

export default function TrustCenterPage() {
  return <TrustCenterContent />;
}
