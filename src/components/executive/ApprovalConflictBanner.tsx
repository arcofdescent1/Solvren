export function ApprovalConflictBanner({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div
      role="status"
      className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm font-medium text-[var(--text)]"
      data-testid="approval-conflict-banner"
    >
      {message}
    </div>
  );
}
