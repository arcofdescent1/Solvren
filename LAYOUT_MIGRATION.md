# SB Admin Pro Layout Migration Summary

This document summarizes the layout system migration for Solvren (Next.js 16 + React 19 + Tailwind v4) to match SB Admin Pro structure. Reference: `sd-admin-pro-main` and https://sb-admin-pro.startbootstrap.com/dashboard-3.html

## 1. Audit Summary (sd-admin-pro-main)

### Layout Structure
- **Topnav**: Fixed height 3.625rem (`--topbar-height`), full width, contains brand, sidebar toggle, search, dropdowns
- **Sidenav**: 15rem width (`--sidenav-width`), fixed left, below topnav; collapsible with overlay on mobile
- **Content**: `#layoutSidenav_content`, flex-grow, min-height `calc(100vh - topnav)`, margin-left for sidebar offset

### Sidebar
- Section groups: Core, Interface, Addons (Solvren: Core, Custom, Admin)
- Nav items with icons, `sidenav-menu-heading` (uppercase 0.7rem)
- Collapsible nested nav with border-left
- Footer: "Logged in as" + user info

### Topbar
- Brand + sidebar toggle (left)
- Search (centered, hidden on mobile)
- Notifications, messages (dropdowns)
- Profile dropdown (avatar, name, email, Account, Logout)

### Tokens Extracted
- Colors: `--primary` (#0061f2), grayscale, status
- Radius: 0.35rem (--radius-sb)
- Shadows: `--shadow-sm`, `--shadow-md`, `--shadow-right`
- Spacing: `--card-spacer-x` 1.35rem, `--card-spacer-y` 1rem
- Breakpoint: `lg` for sidebar visibility

---

## 2. New Layout Architecture

### Folder Structure

```
src/ui/
├── layout/
│   ├── AppShellClient.tsx   # Client wrapper with LayoutProvider
│   ├── app-shell.tsx       # Server component, fetches auth + passes to AppShellClient
│   ├── Content.tsx         # Main content area, respects sidebar open state
│   ├── LayoutContext.tsx   # sidebarOpen state
│   ├── Sidebar.tsx         # Left nav: Core, Custom, Admin
│   ├── Topbar.tsx          # SB-style utility bar
│   ├── container.tsx       # Fluid/constrained
│   └── page-header.tsx     # Breadcrumbs, tabs, actions
├── navigation/
│   ├── SignOutButton.tsx   # Client sign-out
│   ├── TopbarClient.tsx    # (legacy, replaced by layout/Topbar)
│   └── TopbarServer.tsx    # (legacy, replaced by app-shell)
└── tokens/
    ├── index.css           # Core design tokens
    └── layout.css          # Layout tokens (sidenav, topbar, card, z-index)
```

### Components

| Component | Description |
|-----------|-------------|
| **AppShell** | Server component. Fetches user, memberships, activeOrg, unreadCount. Renders AppShellClient. |
| **AppShellClient** | LayoutProvider + Topbar, Sidebar, overlay, Content. Integrates auth, org switcher, notifications, profile. |
| **Sidebar** | Left nav: Core (Dashboard, Reviews, Signals), Custom (Settings), Admin (Ops, Domains) for admins. Section headings, active states. |
| **Topbar** | Sidebar toggle, brand, search (desktop), org switcher, theme toggle, notifications link, profile dropdown (Account, Logout). |
| **Content** | Main area with pt-topbar, pl-sidenav when open. Uses Container inside. |

---

## 3. Design Tokens (src/ui/tokens/)

### layout.css (new)
- `--sidenav-width`, `--topbar-height`, `--footer-height`
- `--sidenav-light-*`, `--sidenav-dark-*`
- `--z-content`, `--z-sidenav`, `--z-topbar`
- `--card-spacer-x`, `--card-spacer-y`, `--card-cap-bg`, `--card-border-color`
- `--input-solid-bg`, `--input-solid-border`
- `--shadow-right`

### index.css (updated)
- `--radius-sb`: 0.35rem

---

## 4. Page Composition Updates

### PageHeader
- **breadcrumbs**: `Array<{ label, href? }>`
- **tabs**: ReactNode for sub-nav
- **actions** / **right**: Action area

### Card (primitives)
- `--radius-sb`, `--card-spacer-x`, `--card-spacer-y`
- CardHeader: `--card-cap-bg`, `text-[var(--primary)]`
- Overflow hidden, shadow-sm

### Container
- `variant="fluid"` (default): full width + horizontal padding
- `variant="constrained"`: `max-w-screen-2xl`

---

## 5. Migration Steps

1. **layout.tsx** – Already uses `AppShell` from `@/ui/layout/app-shell`.
2. **Example migrated page**: `/ops` uses new PageHeader, Card from `@/ui/primitives/card`, design tokens (`var(--text-muted)`, `var(--primary)`, etc.).
3. **TopbarServer / TopbarClient** – Superseded by AppShell + layout/Topbar. TopbarServer/TopbarClient remain for any legacy usage but are no longer used by the layout.

---

## 6. Auth & Integrations

- **Auth**: Supabase; user fetched in AppShell (server).
- **Org switcher**: `OrgSwitcher` in Topbar when `memberships.length > 1`.
- **Notifications**: Link to `/notifications` with unread badge.
- **Profile dropdown**: User initial, email, Account link, SignOutButton (client `supabase.auth.signOut()`).
- **Theme toggle**: Existing ThemeToggle in Topbar.

---

## 7. Responsive Behavior

- **Mobile**: Sidebar off-canvas, overlay on open, full-width content.
- **lg+**: Sidebar toggles in/out; content `pl-[var(--sidenav-width)]` when open, `pl-0` when closed.

---

## 8. ESLint Design Rules

Existing rules kept: use Button, Input, Select, Table from @/ui; no inline styles; no hardcoded hex; prefer Stack/Section/Grid/Container for spacing. UI primitives and layout are excluded from palette/spacing rules.
