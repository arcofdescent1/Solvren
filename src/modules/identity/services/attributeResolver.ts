/**
 * Phase 2 — Preferred attribute resolution (§11). Single resolver layer.
 */

export function resolvePreferredAttributes(
  entityType: string,
  payload: Record<string, unknown>
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (entityType === "person") {
    const email = (payload.email ?? payload.primary_email ?? (payload.properties as Record<string, unknown>)?.email) as string | undefined;
    if (email) out.normalized_email = email.trim().toLowerCase();
    const name = (payload.full_name ?? payload.name ?? (payload.properties as Record<string, unknown>)?.name) as string | undefined;
    if (name) out.full_name = typeof name === "string" ? name.trim() : name;
    const title = (payload.job_title ?? (payload.properties as Record<string, unknown>)?.jobtitle) as string | undefined;
    if (title) out.job_title = title;
  }
  if (entityType === "company") {
    const name = (payload.name ?? (payload.properties as Record<string, unknown>)?.name) as string | undefined;
    if (name) out.company_name = name;
    const domain = (payload.domain ?? payload.website ?? (payload.properties as Record<string, unknown>)?.domain) as string | undefined;
    if (domain) out.website_domain = domain;
  }
  if (entityType === "opportunity") {
    const stage = (payload.stage ?? (payload.properties as Record<string, unknown>)?.dealstage) as string | undefined;
    if (stage) out.stage = stage;
    const amount = (payload.amount ?? payload.value ?? (payload.properties as Record<string, unknown>)?.amount) as number | undefined;
    if (amount != null) out.amount = amount;
  }
  return out;
}
