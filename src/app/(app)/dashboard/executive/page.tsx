/**
 * Phase D1 — Executive Risk Dashboard
 * Redirects to executive-risk for backward compatibility.
 */
import { redirect } from "next/navigation";

export default function ExecutiveDashboardPage() {
  redirect("/dashboard/executive-risk");
}
