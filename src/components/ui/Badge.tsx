import * as React from "react";

type Tone = "neutral" | "primary" | "success" | "warning" | "danger";

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export function Badge({
  tone = "neutral",
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  const tones: Record<Tone, string> = {
    neutral:
      "bg-[color:var(--rg-panel-2)] text-[color:var(--rg-text)] border-[color:var(--rg-border)]",
    primary:
      "bg-[color:var(--rg-primary)]/10 text-[color:var(--rg-primary)] border-[color:var(--rg-primary)]/25",
    success:
      "bg-[color:var(--rg-success)]/10 text-[color:var(--rg-success)] border-[color:var(--rg-success)]/25",
    warning:
      "bg-[color:var(--rg-warning)]/12 text-[color:var(--rg-warning)] border-[color:var(--rg-warning)]/25",
    danger:
      "bg-[color:var(--rg-danger)]/10 text-[color:var(--rg-danger)] border-[color:var(--rg-danger)]/25",
  };

  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 rounded-full border px-2 py-[2px] text-[11px] font-semibold",
        tones[tone],
        className
      )}
      {...props}
    />
  );
}
