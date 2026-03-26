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
    <Card className="shadow-sm">
      <CardBody className="space-y-3">
        {title ? <p className="text-base font-semibold text-[var(--text)]">{title}</p> : null}
        {helper ? <p className="text-sm text-[var(--text-muted)]">{helper}</p> : null}
        {toolbar}
        {filters}
        {bulkActions}
        {loading ? <p className="text-sm text-[var(--text-muted)]">Loading...</p> : children}
        {!loading ? empty : null}
      </CardBody>
    </Card>
  );
}
