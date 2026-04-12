"use client";

import { useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { postPhase3Interaction } from "./postPhase3Interaction";

/** Records executive_summary_opened when user follows an email CTA with ?from=email_summary */
export function Phase3FromEmailSummaryTracker() {
  const sp = useSearchParams();
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current) return;
    if (sp.get("from") !== "email_summary") return;
    fired.current = true;
    postPhase3Interaction({ type: "executive_summary_opened", refType: "email_cta", refId: null });
  }, [sp]);

  return null;
}
