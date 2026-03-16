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
