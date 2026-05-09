# eBiomed Design System Implementation

**Date:** 2026-05-09
**Scope:** Apply the new OKLCH-based design system to the existing Next.js 16 application while preserving all current functionality.

---

## 1. Overview

The existing eBiomed application uses a default shadcn/ui Tailwind v4 theme with gray/black primaries. This design replaces the color palette, layout shell, and component styles with a refined OKLCH-based system featuring a blue primary accent (`#2563eb`), warm light backgrounds, and consistent 8px border radius.

### Design Principles
- **Warm, light surfaces** with subtle borders
- **Blue accent** for primary actions and active states
- **Consistent 8px radius** across all components
- **OKLCH color space** for perceptually uniform colors
- **Mobile-first responsive** with bottom nav on small screens

---

## 2. CSS Theme System (globals.css)

### Color Tokens

Update the `:root` CSS custom properties in `src/app/globals.css`:

| Token | Value | Usage |
|-------|-------|-------|
| `--background` | `oklch(98% 0.005 250)` | Page background (warm light gray) |
| `--foreground` | `oklch(22% 0.02 240)` | Primary text (near-black) |
| `--card` | `oklch(100% 0 0)` | Card/surface backgrounds (white) |
| `--card-foreground` | `oklch(22% 0.02 240)` | Card text |
| `--popover` | `oklch(100% 0 0)` | Popover background |
| `--popover-foreground` | `oklch(22% 0.02 240)` | Popover text |
| `--primary` | `#2563eb` | Primary accent (blue-600) |
| `--primary-foreground` | `oklch(100% 0 0)` | Text on primary backgrounds |
| `--secondary` | `oklch(97% 0 0)` | Secondary surfaces |
| `--secondary-foreground` | `oklch(22% 0.02 240)` | Text on secondary |
| `--muted` | `oklch(97% 0 0)` | Muted backgrounds |
| `--muted-foreground` | `oklch(50% 0.018 240)` | Secondary/muted text |
| `--accent` | `oklch(97% 0 0)` | Accent backgrounds |
| `--accent-foreground` | `oklch(22% 0.02 240)` | Text on accent |
| `--destructive` | `oklch(65% 0.22 25)` | Error/danger |
| `--destructive-foreground` | `oklch(100% 0 0)` | Text on destructive |
| `--border` | `oklch(90% 0.008 240)` | Borders |
| `--input` | `oklch(90% 0.008 240)` | Input borders |
| `--ring` | `#2563eb` | Focus rings |
| `--radius` | `8px` | Border radius |

### Semantic Colors (additional)

Define additional tokens for status badges and alerts:

| Token | Value | Usage |
|-------|-------|-------|
| `--success` | `oklch(58% 0.16 145)` | Success states |
| `--warning` | `oklch(75% 0.18 85)` | Warning states |
| `--danger` | `oklch(65% 0.22 25)` | Danger states |
| `--info` | `oklch(70% 0.15 230)` | Info states |

### Dark Mode

Keep the existing `.dark` selector block but update values to harmonize with the new OKLCH palette:
- Dark background: `oklch(15% 0.02 240)`
- Dark foreground: `oklch(98% 0.005 250)`
- Dark card: `oklch(20% 0.02 240)`
- Dark primary: `#3b82f6` (blue-500 for better contrast on dark)

### Font Tokens

Update font definitions:
- `--font-sans`: `-apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', system-ui, sans-serif`
- `--font-mono`: `'JetBrains Mono', 'IBM Plex Mono', ui-monospace, Menlo, monospace`
- `--font-heading`: Same as `--font-sans`

### @theme inline Mapping

Update `@theme inline` block in `globals.css` to map the new CSS custom properties to Tailwind utility classes:
- `background` → `--background`
- `foreground` → `--foreground`
- `primary` → `--primary`
- `muted-foreground` → `--muted-foreground`
- `border` → `--border`
- `ring` → `--ring`
- `card` → `--card`
- etc.

---

## 3. Layout Components

### 3.1 Sidebar (`src/components/layout/sidebar.tsx`)

**Structure:**
- Container: `aside` with `hidden lg:flex h-screen w-64 flex-col border-r bg-card`
- Header: Remove `border-b` from logo container. Use `px-4 py-6` padding.
- Logo: `text-xl font-bold text-primary` (blue) with `px-2 pb-6`
- Navigation: `flex flex-col gap-1 py-4 px-4`
- Nav links:
  - Container: `flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition-colors`
  - Inactive: `text-muted-foreground hover:bg-background hover:text-foreground`
  - Active: `bg-primary/[0.08] text-primary font-semibold`
- Keep existing icon mapping and `NAV_ITEMS` constant
- Keep existing `usePathname` active state logic

### 3.2 AppHeader (`src/components/layout/app-header.tsx`)

**Structure:**
- Container: `header` with `flex h-16 items-center justify-end border-b bg-card px-8`
- Left side: Keep mobile hamburger and logo with `lg:hidden` visibility toggle
- Right side: Keep user avatar dropdown menu
  - Avatar fallback with initials
  - Dropdown with email display and sign-out form action
- Background: `bg-card` (white)
- Border: `border-border` (subtle OKLCH border)
- The header is hidden on mobile (content area gets top padding to clear `MobileHeader` if we add one, but current structure uses `BottomNav` + sidebar logo area)

### 3.3 BottomNav (`src/components/layout/bottom-nav.tsx`)

**Structure:**
- Container: `nav` with `fixed bottom-0 left-0 right-0 z-50 flex h-16 border-t bg-card lg:hidden`
- Items: `flex-1 flex-col items-center justify-center gap-1 text-xs`
- Active state: `text-primary font-medium`
- Inactive state: `text-muted-foreground`
- Keep existing 5 bottom nav items (Home, Equip, WOs, PMs, Parts)
- Keep existing `usePathname` active state logic
- Add `lg:hidden` to hide on desktop

### 3.4 App Layout (`src/app/(app)/layout.tsx`)

**Structure:**
- Root: `div` with `flex min-h-screen`
- Sidebar: `<Sidebar />`
- Main area: `flex flex-1 flex-col`
  - AppHeader: `<AppHeader />`
  - Content: `main` with `flex-1 overflow-auto bg-background p-8 pb-20 lg:p-8 lg:pb-8`
- BottomNav: `<BottomNav />`

---

## 4. shadcn/ui Component Restyling

### 4.1 Button (`src/components/ui/button.tsx`)

Keep CVA structure, update variant styles:

| Variant | Styles |
|---------|--------|
| `default` | `bg-primary text-primary-foreground border-primary shadow-none` |
| `destructive` | `bg-destructive text-destructive-foreground border-destructive shadow-none` |
| `outline` | `bg-transparent text-foreground border-border hover:bg-background hover:text-foreground` |
| `secondary` | `bg-secondary text-secondary-foreground border-transparent hover:bg-secondary/80` |
| `ghost` | `hover:bg-background hover:text-foreground` |
| `link` | `text-primary underline-offset-4 hover:underline` |

- Add `transition-all duration-150 ease-in-out` to base styles
- Size variants stay the same (`default`, `sm`, `lg`, `icon`)

### 4.2 Card (`src/components/ui/card.tsx`)

Update wrapper styles:
- `bg-card`
- `text-card-foreground`
- `border border-border`
- `rounded-lg` (8px)
- `shadow-[0_1px_2px_0_rgba(0,0,0,0.05)]`

Header, title, description, content, and footer keep structural classes but inherit new colors.

### 4.3 Badge (`src/components/ui/badge.tsx`)

Update CVA to include status color variants:

| Variant | Background | Foreground |
|---------|-----------|------------|
| `default` | `bg-muted text-muted-foreground` | Gray |
| `secondary` | `bg-secondary text-secondary-foreground` | Light gray |
| `destructive` | `bg-destructive/10 text-destructive` | Red |
| `outline` | `text-foreground border-border` | Bordered |
| `success` | `bg-[oklch(58%_0.16_145)]/10 text-[oklch(40%_0.15_145)]` | Green |
| `warning` | `bg-[oklch(75%_0.18_85)]/10 text-[oklch(50%_0.18_85)]` | Yellow/Orange |
| `info` | `bg-[oklch(70%_0.15_230)]/10 text-[oklch(50%_0.15_230)]` | Blue/Purple |

Keep `rounded-full px-3 py-1 text-xs font-medium`

### 4.4 Input (`src/components/ui/input.tsx`)

Update base input styles:
- `flex h-9 w-full rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground`
- Focus: `outline-2 outline-primary outline-offset-[-1px] border-primary`
- Placeholder: `placeholder:text-muted-foreground`
- Disabled: `opacity-50 cursor-not-allowed`
- Remove `shadow-sm` if present (design uses flat inputs)

### 4.5 Table (`src/components/ui/table.tsx`)

Update styles across table subcomponents:
- **Table wrapper**: `w-full caption-bottom text-sm`
- **Header row**: `border-b border-border`
- **Header cell**: `h-10 px-4 py-3 text-left align-middle font-medium text-muted-foreground text-xs uppercase tracking-wider`
- **Body row**: `border-b border-border transition-colors hover:bg-background`
- **Body cell**: `p-4 align-middle`
- **Caption**: `mt-4 text-sm text-muted-foreground`

---

## 5. Page Containers & Spacing

### 5.1 App Layout Container

In `src/app/(app)/layout.tsx`:
- Change main content background from `bg-gray-50` to `bg-background`
- Update padding to `p-8 pb-20 lg:p-8 lg:pb-8`

### 5.2 Individual Page Titles

Standardize page heading style:
- `h2` with `text-2xl font-semibold tracking-tight text-foreground`
- Container spacing: `space-y-6`

### 5.3 Stats Cards & Dashboard Components

Existing dashboard components (`StatsCards`, `ActivityFeed`, `OverduePMAlert`, `LowStockAlert`) will inherit new theme colors automatically through shadcn/ui component updates. No structural changes needed.

---

## 6. Files to Modify

| File | Changes |
|------|---------|
| `src/app/globals.css` | Replace color tokens, update `@theme inline`, add semantic color tokens |
| `src/components/layout/sidebar.tsx` | Update padding, colors, active state styles |
| `src/components/layout/app-header.tsx` | Update background, border, padding colors |
| `src/components/layout/bottom-nav.tsx` | Update active/inactive colors, background |
| `src/app/(app)/layout.tsx` | Update background and padding |
| `src/components/ui/button.tsx` | Update variant colors, add transitions |
| `src/components/ui/card.tsx` | Update background, border, shadow, radius |
| `src/components/ui/badge.tsx` | Add status color variants |
| `src/components/ui/input.tsx` | Update focus styles, background, border |
| `src/components/ui/table.tsx` | Update header/border/hover styles |

---

## 7. Out of Scope

The following are explicitly NOT part of this design:

- Rebuilding pages to match HTML prototypes (only theme/layout changes)
- Changing page functionality or data fetching
- Adding new pages or routes
- Modifying auth flows
- Changing the database schema
- Adding animations beyond basic CSS transitions
- Modifying `screens/*.html` prototype files (they are reference only)

---

## 8. Testing Checklist

After implementation, verify:

- [ ] All pages render without errors
- [ ] Sidebar active state highlights correctly on each page
- [ ] Bottom nav shows on mobile (< 1024px) and hides on desktop
- [ ] App header shows user avatar dropdown
- [ ] Buttons have correct colors (primary = blue, outline = bordered)
- [ ] Cards have subtle shadow and 8px radius
- [ ] Badges display status colors correctly
- [ ] Inputs have blue focus ring
- [ ] Tables have proper header styling and row hover
- [ ] Dark mode still works (if previously enabled)
