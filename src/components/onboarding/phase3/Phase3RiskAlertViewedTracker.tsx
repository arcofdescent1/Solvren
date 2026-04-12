"use client";

import { useEffect } from "react";
import { postPhase3Interaction } from "./postPhase3Interaction";

export function Phase3RiskAlertViewedTracker(props: { riskEventId: string }) {
  useEffect(() => {
    postPhase3Interaction({ type: "alert_clicked", refType: "risk_event", refId: props.riskEventId });
  }, [props.riskEventId]);
  return null;
}
