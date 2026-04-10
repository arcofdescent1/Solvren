import { redirect } from "next/navigation";

/** Phase 3 — single intake entry path. */
export default function LegacyNewChangePage() {
  redirect("/intake/new");
}
