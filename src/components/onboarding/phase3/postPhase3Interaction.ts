/**
 * Fire-and-forget Phase 3 habit interaction (non-onboarding routes only; server validates type).
 */
export function postPhase3Interaction(args: {
  type: string;
  refType?: string | null;
  refId?: string | null;
}): void {
  void fetch("/api/onboarding/phase3/interaction", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      type: args.type,
      refType: args.refType ?? undefined,
      refId: args.refId ?? undefined,
    }),
  }).catch(() => {});
}
