import type { SupabaseClient } from "@supabase/supabase-js";
import type { EvidenceKind, RiskBucket } from "@/services/risk/requirements";
import type { RiskDomain } from "@/types/risk";

export type ChecklistSection = { title?: string; items?: string[] };

export type GovernanceTemplate = {
  domain: RiskDomain;
  risk_bucket: RiskBucket;
  required_evidence_kinds: EvidenceKind[];
  required_approval_areas: string[];
  checklist_sections: ChecklistSection[];
};

export async function getGovernanceTemplate(
  supabase: SupabaseClient,
  domain: RiskDomain,
  bucket: RiskBucket
): Promise<GovernanceTemplate | null> {
  const { data, error } = await supabase
    .from("domain_governance_templates")
    .select(
      "domain, risk_bucket, required_evidence_kinds, required_approval_areas, checklist_sections"
    )
    .eq("domain", domain)
    .eq("risk_bucket", bucket)
    .eq("enabled", true)
    .maybeSingle();

  if (error || !data) return null;

  const rawSections = (data.checklist_sections ?? []) as ChecklistSection[] | string[];
  const checklist_sections: ChecklistSection[] = Array.isArray(rawSections)
    ? rawSections.length > 0 &&
      typeof rawSections[0] === "object" &&
      rawSections[0] !== null
      ? (rawSections as ChecklistSection[])
      : [{ title: "Governance checklist", items: rawSections as string[] }]
    : [];

  return {
    domain: data.domain as RiskDomain,
    risk_bucket: data.risk_bucket as RiskBucket,
    required_evidence_kinds: (data.required_evidence_kinds ?? []) as EvidenceKind[],
    required_approval_areas: (data.required_approval_areas ?? []) as string[],
    checklist_sections,
  };
}
