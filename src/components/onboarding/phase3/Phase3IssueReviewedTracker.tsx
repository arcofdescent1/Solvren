"use client";

import { useEffect } from "react";
import { postPhase3Interaction } from "./postPhase3Interaction";

export function Phase3IssueReviewedTracker(props: { issueId: string }) {
  useEffect(() => {
    postPhase3Interaction({ type: "issue_reviewed", refType: "issue", refId: props.issueId });
  }, [props.issueId]);
  return null;
}
