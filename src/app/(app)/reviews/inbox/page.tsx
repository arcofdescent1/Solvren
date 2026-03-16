import { redirect } from "next/navigation";

// Phase 3: Ops Inbox (daily driver).
// This is an alias route that lands users on the Reviews table default view.
// We keep /reviews as the canonical implementation to avoid duplicating UI logic.

export default async function OpsInboxPage() {
  redirect("/reviews?view=in_review");
}
