/**
 * Trust UX — high-level data boundary (not a network diagram).
 */
export function DataBoundaryDiagram() {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 text-sm text-[var(--text-muted)]">
      <p className="mb-3 font-semibold text-[var(--text)]">Data flow (simplified)</p>
      <ol className="list-decimal space-y-2 pl-5">
        <li>Your systems → read-only connectors (sanitized operational events).</li>
        <li>Solvren processing → policy checks (`assertPrivacyPolicy`), no raw payload persistence.</li>
        <li>ROI &amp; dashboards → estimates with explicit provenance; not audited financials.</li>
        <li>Write-back → off by default; audited when enabled.</li>
      </ol>
    </div>
  );
}
