"use client";

export function DocsCommandTrigger() {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", ctrlKey: true, bubbles: true }))}
      className="inline-flex items-center gap-2 rounded-2xl border border-[var(--border)] bg-[var(--input-solid-bg)] px-4 py-2 text-sm text-[var(--text-muted)] transition hover:border-[var(--border-strong)] hover:text-[var(--text)]"
    >
      Search docs
      <span className="rounded border border-[var(--border)] px-2 py-0.5 text-xs text-[var(--text-subtle)]">Ctrl+K</span>
    </button>
  );
}
