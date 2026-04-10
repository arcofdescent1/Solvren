import type { SignoffSummary as SignoffSummaryT } from "@/lib/executive/types";

export function SignoffSummary({ signoffs }: { signoffs: SignoffSummaryT }) {
  return (
    <section className="space-y-3">
      <h2 className="text-xl font-bold text-[var(--text)]">Team sign-off</h2>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Approved</div>
          <ul className="mt-2 list-inside list-disc text-sm text-[var(--text)]">
            {signoffs.approved.length ? (
              signoffs.approved.map((x) => <li key={x}>{x}</li>)
            ) : (
              <li className="list-none text-[var(--text-muted)]">None yet</li>
            )}
          </ul>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Still needed</div>
          <ul className="mt-2 list-inside list-disc text-sm text-[var(--text)]">
            {signoffs.pending.length ? (
              signoffs.pending.map((x) => <li key={x}>{x}</li>)
            ) : (
              <li className="list-none text-[var(--text-muted)]">None pending</li>
            )}
          </ul>
        </div>
      </div>
    </section>
  );
}
