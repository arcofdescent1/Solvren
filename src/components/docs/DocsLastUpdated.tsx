function formatDate(v: string) {
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return v;
  return new Intl.DateTimeFormat("en-US", { year: "numeric", month: "long", day: "numeric" }).format(d);
}

export function DocsLastUpdated({ value }: { value?: string }) {
  if (!value) return null;
  return (
    <div className="mt-4 text-sm text-[var(--text-muted)]">
      Last updated <span className="text-[var(--text)]">{formatDate(value)}</span>
    </div>
  );
}
