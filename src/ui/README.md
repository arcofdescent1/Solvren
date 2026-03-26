# UI System Usage Guide (Phase 5)

This file is the source of truth for core app-surface composition.

## Page Anatomy

Use this structure for major pages:

1. `PageHeaderV2`
2. optional intro/helper
3. optional summary row/cards
4. optional filters/segments
5. primary content surface (`TableShell`, cards, or lists)
6. optional secondary content surface
7. standardized empty states

## Use This, Not That

- Use `PageHeaderV2` for major pages; avoid new usages of legacy `PageHeader`.
- Use `SectionHeader` for section title/helper/action pattern.
- Use `StatusBadge` for standardized status rendering; avoid ad hoc status pill classes.
- Use `EmptyState` for variant-based empty handling (`good_empty`, `filtered_empty`, `incomplete_setup`, `still_building`).
- Use `TableShell` for table chrome (header/helper/toolbar/filters/bulk actions/empty/loading).

## CTA Hierarchy

- Primary: one high-priority action per area.
- Secondary: contextual follow-up actions.
- Tertiary/link: informational and low-priority navigation.
- Destructive: only truly destructive operations.

Avoid multiple primary-styled actions side-by-side in the same local area.

## Status Badge Mapping

Use only mapped keys in `StatusBadge`:

- `needs_review`
- `needs_details`
- `on_track`
- `overdue`
- `delivery_issue`
- `waiting_on_others`
- `monitoring`
- `no_action_needed`
- `verified`

## TableShell Ownership

`TableShell` owns:

- section title/helper
- toolbar/filter/bulk-action slots
- loading/empty framing

Feature pages still own:

- data fetching
- column definitions
- sorting/filter logic

## Notes

- Prefer tokenized color/spacing usage.
- Avoid page-specific one-off primitives where a shared primitive exists.
# Solvren UI Layer (SB Admin Pro Baseline)

This folder is the **only** place UI styling and primitives should live.
Pages/components should compose primitives rather than styling raw HTML.

## Install deps

```bash
npm i class-variance-authority clsx tailwind-merge lucide-react       @radix-ui/react-dropdown-menu @radix-ui/react-dialog @radix-ui/react-tooltip       @radix-ui/react-tabs @radix-ui/react-switch @radix-ui/react-checkbox       @radix-ui/react-select @radix-ui/react-toast
```

## Enable tokens + base styles

In `src/app/globals.css`, add after `@import "tailwindcss";`:

```css
@import "../ui/styles/index.css";
```

## Prevent theme flash

In `src/app/layout.tsx`, add inside `<head>`:

```tsx
import { ThemeInitScript } from "@/ui/theme/ThemeInitScript";

// ...
<head>
  <ThemeInitScript />
</head>
```

## Use AppShell

In `src/app/layout.tsx` wrap `{children}`:

```tsx
import { AppShell } from "@/ui/layout/app-shell";

<body>
  <AppShell>{children}</AppShell>
</body>
```

## Enforcement

Add ESLint restrictions to ban raw `button/input/select/textarea` usage outside `/src/ui/primitives`.
