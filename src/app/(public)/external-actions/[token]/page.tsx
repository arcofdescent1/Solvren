import { createAdminClient } from "@/lib/supabase/admin";
import { resolveExecutiveExternalToken } from "@/lib/external-actions/executiveActionToken";
import { buildExecutiveChangeView } from "@/lib/executive/buildExecutiveChangeView";
import { ExecutiveTokenDecisionClient } from "./ExecutiveTokenDecisionClient";

export default async function ExecutiveExternalActionPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token: rawToken } = await params;
  const token = decodeURIComponent(rawToken);
  const admin = createAdminClient();
  const resolved = await resolveExecutiveExternalToken(admin, token);

  if (!resolved.ok) {
    const message =
      resolved.reason === "used"
        ? "This decision link was already used."
        : resolved.reason === "expired"
          ? "This link has expired."
          : "We could not validate this link.";
    return (
      <div className="mx-auto max-w-lg p-8">
        <h1 className="text-xl font-semibold text-neutral-900">Link unavailable</h1>
        <p className="mt-2 text-sm text-neutral-600">{message}</p>
      </div>
    );
  }

  const view = await buildExecutiveChangeView(admin, resolved.changeEventId);
  const title = view?.title ?? "Change";

  return (
    <div className="mx-auto max-w-lg space-y-6 p-8">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-amber-900">Executive decision</p>
        <h1 className="mt-1 text-2xl font-semibold text-neutral-900">{title}</h1>
        <p className="mt-3 text-sm text-neutral-600">
          This page records an executive overlay decision only. Domain approvals (Finance, Billing, etc.) are still
          required before release.
        </p>
      </div>
      <ExecutiveTokenDecisionClient token={token} />
    </div>
  );
}
