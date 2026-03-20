# Phase 0 — North Star Translation

## Purpose

Phase 0 converts the Solvren North Star (detect → quantify → prioritize → route → resolve → verify) into product-operating rules that engineering and product implement against.

## Product Rules

1. Every material problem in Solvren is an **issue**.
2. Every issue has a **source**.
3. Every issue has an **owner**.
4. Every issue has an **impact posture**, even if impact is temporarily unknown.
5. Every issue has a **resolution state**.
6. Every issue has a **verification state**.
7. Every issue must be traceable back to the source evidence that created it.
8. Every issue must be representable in executive, operational, and engineering views.
9. Changes remain a first-class workflow, but they must plug into the issue lifecycle rather than define it.
10. No Phase 1+ work may bypass the issue model.

## Canonical Nouns

- **Source** — Originating mechanism that introduces a potential problem (change request, detector, integration event, incident, manual report).
- **Signal** — Normalized observation or event from a connected system.
- **Issue** — Canonical representation of a business or operational problem requiring triage, routing, resolution, and verification.
- **Impact Assessment** — Calculation or estimate of revenue risk, customer effect, operational burden, and confidence.
- **Action** — Recommended or executed step on an issue.
- **Task** — Routable work artifact (internal or external).
- **Resolution** — State indicating the team believes the issue has been addressed.
- **Verification** — State and evidence proving the issue condition is cleared or acceptably contained.

## Deprecated Framing

These may remain as UX terms but must not be the primary system model:

- "Change" as the main app object
- "Alert" as a top-level object instead of issue or signal
- "Risk event" as a replacement for issue
- "Approval object" detached from issue lifecycle
