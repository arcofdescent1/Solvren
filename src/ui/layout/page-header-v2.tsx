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
    <>
      {actions}
      {helpTrigger}
    </>
  );

  return (
    <div className="space-y-2">
      <PageHeader
        title={title}
        description={description}
        breadcrumbs={breadcrumbs}
        right={right}
        className={className}
      />
      {helper ? <p className="text-sm text-[var(--text-muted)]">{helper}</p> : null}
    </div>
  );
}
