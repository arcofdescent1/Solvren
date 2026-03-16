# SB Admin Pro Fidelity Specification

Version: 1.0  
Purpose: Lock Solvren UI to a mathematically defined SB Admin Pro visual baseline.

---

# 1. Typography System

## Base Font

- **Font Family:** Primary: Metropolis (or Inter if substituted), Fallback: system-ui stack
- **Root Font Size:** 0.875rem (14px equivalent)
- **Letter Spacing:** Headings: -0.01em, Uppercase labels: 0.04em–0.06em

## Heading Scale

| Element | Size   | Weight | Line Height |
|---------|--------|--------|-------------|
| h1      | 1.5rem | 700    | 2rem        |
| h2      | 1.25rem| 700    | 1.75rem     |
| h3      | 1.125rem| 700   | 1.5rem      |
| body    | 0.875rem| 400   | 1.5rem      |
| small/meta | 0.75rem | 500 | 1.25rem     |

---

# 2. Spacing System

Base unit: 4px grid. Page section spacing: 1.5rem (24px) between cards. Card padding: 1.25rem.

---

# 3. Radius System

| Component  | Radius |
|------------|--------|
| Buttons    | 10px   |
| Inputs     | 10px   |
| Cards      | 12px   |
| Dropdowns  | 12px   |
| Modals     | 16px   |

---

# 4. Border System

- Light: `rgba(31, 45, 65, 0.075)`
- Dark: `rgba(255, 255, 255, 0.08)`

---

# 5. Shadow System

- **Primary Card:** `0 0.15rem 1.75rem 0 rgba(33, 40, 50, 0.15)`
- **Small Elevation:** `0 0.125rem 0.25rem 0 rgba(33, 40, 50, 0.075)`
- **Dark Card:** `0 0.15rem 1.75rem 0 rgba(0, 0, 0, 0.35)`

---

# 6. Background Layering

Light: App #f2f6fc, Card #ffffff, Cap #f8fafc, Table header #f8fafc.  
Dark: App #0f172a, Card #111827.

---

# 7. Anti-Patterns

Not allowed:

- Hard-coded Tailwind colors
- Arbitrary spacing values
- Card headers with primary (blue) text
- Serif fonts
- Inline styles
