import * as React from "react";
import { Card, CardBody } from "./card";

type TableShellProps = {
  title?: React.ReactNode;
  helper?: React.ReactNode;
  toolbar?: React.ReactNode;
  filters?: React.ReactNode;
  bulkActions?: React.ReactNode;
  loading?: boolean;
  empty?: React.ReactNode;
  children?: React.ReactNode;
};

export function TableShell({
  title,
  helper,
  toolbar,
  filters,
  bulkActions,
  loading,
  empty,
  children,
}: TableShellProps) {
  return (
    <Card>
      <CardBody className="space-y-4">
        {(title || helper || toolbar) ? (
          <div className="flex flex-col gap-3 border-b border-[var(--border)] pb-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              {title ? <p className="text-base font-semibold text-[var(--text)]">{title}</p> : null}
              {helper ? <p className="mt-1 text-sm text-[var(--text-muted)]">{helper}</p> : null}
            </div>
            {toolbar ? <div className="flex shrink-0 flex-wrap items-center gap-2">{toolbar}</div> : null}
          </div>
        ) : null}
        {filters}
        {bulkActions}
        {loading ? <p className="rounded-md bg-[var(--bg-surface-2)] px-3 py-2 text-sm text-[var(--text-muted)]">Loading...</p> : children}
        {!loading ? empty : null}
      </CardBody>
    </Card>
  );
}
