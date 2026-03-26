type Props = {
  text: string;
};

export function WhatHappensNextCallout({ text }: Props) {
  return (
    <div className="rounded-md border border-[var(--border)] bg-[var(--bg-surface-2)] p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
        What happens next
      </p>
      <p className="mt-1 text-sm text-[var(--text)]">{text}</p>
    </div>
  );
}
