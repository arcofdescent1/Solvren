"use client";

import { useEffect } from "react";

/** Counts value story views toward Phase 3 habit milestones. */
export function Phase3ValueStoryTracker(props: { storyId: string }) {
  useEffect(() => {
    void fetch("/api/onboarding/phase3/interaction", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "value_story_viewed",
        refType: "value_story",
        refId: props.storyId,
      }),
    }).catch(() => {});
  }, [props.storyId]);
  return null;
}
