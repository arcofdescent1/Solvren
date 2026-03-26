import * as React from "react";

type SectionHeaderProps = {
  title: React.ReactNode;
  helper?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
};

export function SectionHeader({ title, helper, action, className }: SectionHeaderProps) {
  return (
    <div className={className ?? ""}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-[var(--text)]">{title}</h2>
        {action}
      </div>
      {helper ? <p className="mt-1 text-sm text-[var(--text-muted)]">{helper}</p> : null}
    </div>
  );
}
