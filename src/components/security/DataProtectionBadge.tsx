import type { PrivacyMode } from "@/lib/server/privacy/privacy-policy";

export function DataProtectionBadge({ mode }: { mode: PrivacyMode }) {
  const label = mode === "expanded" ? "Expanded Insights Mode" : "Minimal Data Mode";
  return (
    <span className="inline-flex items-center rounded-full border border-[var(--border)] bg-[var(--surface)] px-2.5 py-0.5 text-xs font-medium text-[var(--text)]">
      {label}
    </span>
  );
}
