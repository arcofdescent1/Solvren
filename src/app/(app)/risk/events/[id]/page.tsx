/**
 * Phase D6 — Risk Investigation Page (spec route /risk/events/{id})
 * Redirects to canonical /risk/event/[eventId].
 */
import { redirect } from "next/navigation";

export default async function RiskEventRedirectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/risk/event/${id}`);
}
