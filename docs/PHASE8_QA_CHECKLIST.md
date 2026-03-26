## Phase 8 QA Checklist — Frontend Simplification

This checklist captures what was validated for the Phase 8 polish / performance / launch-readiness pass.

- **Surfaces covered (in order)**  
  - Home  
  - Insights (including `/insights/roi`)  
  - Changes  
  - Issues  
  - Action Center  
  - Settings (top-level + policies)  
  - Integrations (landing)

- **UX / visual polish**  
  - Section spacing and header padding consistent across the above pages.  
  - Titles and `SectionHeader` text use the same typography scale; helper text is muted and readable.  
  - Redundant badges, borders, and duplicated helper copy removed on primary sections.  
  - Legacy labels replaced with canonical terms: **Home**, **Action Center**, **Insights**, **Changes**, **Issues**.

- **Loading & skeletons**  
  - Page headers and section headers render immediately (no full-page spinners).  
  - `SectionSkeleton` used for section-level loading; no major layout jumps when data resolves.  
  - Home, Insights, and ROI all show structured skeletons instead of empty or shifting layouts.

- **Errors & fallback behavior**  
  - `SectionError` used when a section’s data fails to load, with:  
    - Title: “Something went wrong”  
    - Body: “We couldn’t load this section right now. Try refreshing or check back shortly.”  
    - Optional per-section retry that only refetches that section.  
  - Other sections continue to work when one section fails (no page-wide failure).  
  - Auth / org errors do not leak internal messages into the UI.

- **Performance & data fetching**  
  - Short-lived (≤ 5 min) stale-while-revalidate used for summary endpoints (Home overview, Insights, ROI).  
  - No obvious duplicate API calls for the same summary data on a single page.  
  - Heavy derived lists memoized where needed to avoid avoidable re-renders.

- **Home ⇄ Insights ⇄ ROI alignment**  
  - Home “Impact signal” derives from the same ROI summary model as `/api/insights/roi-summary`.  
  - ROI trend state (`improving / stable / needs attention`) matches between Home and Insights/ROI for the same org + window.  
  - ROI story cards deep-link to Issues/Changes with `source=roi` context.

- **Navigation & routing**  
  - All in-app links on covered surfaces point to canonical routes (no remaining direct links to `/dashboard`, `/executive`, `/org/settings`).  
  - Back navigation from detail views (especially Changes and Issues) preserves filters and general list context where feasible.

- **Accessibility basics**  
  - Primary flows (nav, hero CTAs, tables, ROI cards) are keyboard-navigable with visible focus states.  
  - Tooltips and help triggers are activated via click and keyboard (Enter/Space), not hover-only.  

- **Analytics & console hygiene**  
  - Key analytics events verified in practice for: Home interactions, Changes workspace, Insights, ROI, and help/tooltips.  
  - No debug-style `console.log`/`console.debug` noise on primary flows in demo/prod builds.

- **Tests executed**  
  - TypeScript: `npm run typecheck --silent`.  
  - Playwright (Phase 6 & 7):  
    - `tests/phase6-insights.spec.ts` (Insights narrative + navigation).  
    - `tests/phase7-roi.spec.ts` (ROI evidence layer + Home impact signal).  
  - Playwright (Home):  
    - `tests/home-phase3.spec.ts` (Home command center sections and navigation).  
  - ROI helper unit tests: `src/features/roi/attribution.test.ts`.

