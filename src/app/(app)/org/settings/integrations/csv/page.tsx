import { redirect } from "next/navigation";

/** Phase 3 — CSV integration UI retired; spreadsheet import lives under Imports. */
export default function LegacyCsvIntegrationRedirect() {
  redirect("/imports/new");
}
