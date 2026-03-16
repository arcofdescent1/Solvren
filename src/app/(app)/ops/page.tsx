/**
 * Gap 2: Ops moved to Settings → System diagnostics. Redirect so bookmarks and
 * old links still work.
 */
import { redirect } from "next/navigation";

export default function OpsPage() {
  redirect("/settings/system/diagnostics");
}
