"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

const SOURCE_OPTIONS = [
  { value: "", label: "All sources" },
  { value: "change", label: "Change" },
  { value: "detector", label: "Detector" },
  { value: "integration_event", label: "Integration" },
  { value: "incident", label: "Incident" },
  { value: "manual", label: "Manual" },
  { value: "system_health", label: "System health" },
  { value: "verification_failure", label: "Verification failure" },
];

const SEVERITY_OPTIONS = [
  { value: "", label: "All severities" },
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "critical", label: "Critical" },
];

const VERIFICATION_OPTIONS = [
  { value: "", label: "Any verification" },
  { value: "pending", label: "Pending" },
  { value: "passed", label: "Passed" },
  { value: "failed", label: "Failed" },
  { value: "not_required", label: "Not required" },
];

function buildHref(searchParams: URLSearchParams, updates: Record<string, string>) {
  const next = new URLSearchParams(searchParams);
  for (const [key, value] of Object.entries(updates)) {
    if (value) next.set(key, value);
    else next.delete(key);
  }
  next.delete("page");
  return `/issues${next.toString() ? `?${next.toString()}` : ""}`;
}

export function IssuesFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const source = searchParams.get("source_type") ?? "";
  const severity = searchParams.get("severity") ?? "";
  const domain = searchParams.get("domain_key") ?? "";
  const verification = searchParams.get("verification_status") ?? "";

  return (
    <div className="flex flex-wrap items-center gap-3">
      <select
        value={source}
        onChange={(e) => router.push(buildHref(searchParams, { source_type: e.target.value }))}
        aria-label="Filter by source type"
        className="h-9 rounded-md border border-[var(--border)] bg-[var(--bg)] px-2 text-sm text-[var(--text)]"
      >
        {SOURCE_OPTIONS.map((o) => (
          <option key={o.value || "all"} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <select
        value={severity}
        onChange={(e) => router.push(buildHref(searchParams, { severity: e.target.value }))}
        aria-label="Filter by severity"
        className="h-9 rounded-md border border-[var(--border)] bg-[var(--bg)] px-2 text-sm text-[var(--text)]"
      >
        {SEVERITY_OPTIONS.map((o) => (
          <option key={o.value || "all"} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <input
        type="text"
        placeholder="Domain"
        className="h-9 w-28 rounded-md border border-[var(--border)] bg-[var(--bg)] px-2 text-sm text-[var(--text)]"
        defaultValue={domain}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            const v = (e.target as HTMLInputElement).value.trim();
            router.push(buildHref(searchParams, { domain_key: v }));
          }
        }}
        aria-label="Filter by domain"
      />
      <select
        value={verification}
        onChange={(e) => router.push(buildHref(searchParams, { verification_status: e.target.value }))}
        aria-label="Filter by verification"
        className="h-9 rounded-md border border-[var(--border)] bg-[var(--bg)] px-2 text-sm text-[var(--text)]"
      >
        {VERIFICATION_OPTIONS.map((o) => (
          <option key={o.value || "all"} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {(source || severity || domain || verification) && (
        <Link href="/issues" className="text-sm text-[var(--primary)] hover:underline">
          Clear filters
        </Link>
      )}
    </div>
  );
}
