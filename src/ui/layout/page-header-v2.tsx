import * as React from "react";
import { PageHeader } from "./page-header";

export type PageHeaderV2Props = {
  title: React.ReactNode;
  description?: React.ReactNode;
  helper?: React.ReactNode;
  actions?: React.ReactNode;
  helpTrigger?: React.ReactNode;
  breadcrumbs?: Array<{ label: string; href?: string }>;
  className?: string;
};

/**
 * Canonical page header wrapper for Phase 5+.
 * Keeps layout behavior stable while normalizing API for major app pages.
 */
export function PageHeaderV2({
  title,
  description,
  helper,
  actions,
  helpTrigger,
  breadcrumbs,
  className,
}: PageHeaderV2Props) {
  const right = (
    <div className="flex flex-wrap items-center gap-2">
      {actions}
      {helpTrigger}
    </div>
  );

  return (
    <div className="space-y-3">
      <PageHeader
        title={title}
        description={description}
        breadcrumbs={breadcrumbs}
        right={actions || helpTrigger ? right : undefined}
        className={className}
      />
      {helper ? <p className="max-w-4xl px-1 text-sm leading-6 text-[var(--text-muted)]">{helper}</p> : null}
    </div>
  );
}
