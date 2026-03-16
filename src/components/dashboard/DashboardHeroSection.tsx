"use client";

import { useState } from "react";
import { DashboardHeroMetrics } from "./DashboardHeroMetrics";
import { Switch } from "@/ui/primitives/switch";

export type DashboardHeroSectionProps = {
  totalExposure: number;
  highRiskEvents: number;
  unapprovedChanges: number;
  complianceRate: number;
};

export function DashboardHeroSection(props: DashboardHeroSectionProps) {
  const [showCalculationDetails, setShowCalculationDetails] = useState(false);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-end gap-2 text-sm">
        <label htmlFor="cfo-details" className="text-[var(--text-muted)]">
          Show calculation details
        </label>
        <Switch
          id="cfo-details"
          checked={showCalculationDetails}
          onCheckedChange={setShowCalculationDetails}
        />
      </div>
      <DashboardHeroMetrics
        {...props}
        showCalculationDetails={showCalculationDetails}
      />
    </div>
  );
}
