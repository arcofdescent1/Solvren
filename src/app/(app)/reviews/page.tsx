/**
 * Redirect to canonical /changes route (V1 spec).
 */
import { redirect } from "next/navigation";

export default async function ReviewsRedirectPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; learnedRisk?: string; hasIncidents?: string }>;
}) {
  const params = await searchParams;
  const q = new URLSearchParams();
  if (params.view) q.set("view", params.view);
  if (params.learnedRisk === "1") q.set("learnedRisk", "1");
  if (params.hasIncidents === "1") q.set("hasIncidents", "1");
  redirect(`/changes${q.toString() ? `?${q}` : ""}`);
}
