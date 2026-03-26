"use client";

import { METRIC_HELP, type MetricHelpKey } from "@/config/metricHelp";
import { InfoTooltip } from "./InfoTooltip";

type Props = {
  metricKey: MetricHelpKey;
  page: string;
  section: string;
};

export function MetricHelpTooltip({ metricKey, page, section }: Props) {
  return (
    <InfoTooltip
      content={METRIC_HELP[metricKey]}
      label={`Help: ${metricKey}`}
      eventName="metric_help_open"
      payload={{ page, section, help_key: metricKey }}
    />
  );
}
