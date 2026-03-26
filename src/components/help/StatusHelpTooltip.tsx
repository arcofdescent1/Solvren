"use client";

import { STATUS_HELP, type StatusHelpKey } from "@/config/statusHelp";
import { InfoTooltip } from "./InfoTooltip";

type Props = {
  statusKey: StatusHelpKey;
  page: string;
  section: string;
};

export function StatusHelpTooltip({ statusKey, page, section }: Props) {
  return (
    <InfoTooltip
      content={STATUS_HELP[statusKey]}
      label={`Status help: ${statusKey}`}
      eventName="status_help_open"
      payload={{ page, section, help_key: statusKey }}
    />
  );
}
