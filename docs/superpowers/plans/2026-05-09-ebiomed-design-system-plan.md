# eBiomed Design System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply the new OKLCH-based design system to the existing Next.js 16 app, updating theme tokens, layout shell, and shadcn/ui component styles while preserving all functionality.

**Architecture:** Replace CSS custom properties in `globals.css`, restyle layout components (`Sidebar`, `AppHeader`, `BottomNav`) to match the new app shell, and update shadcn/ui base components (`Button`, `Card`, `Badge`, `Input`, `Table`) to use the new color tokens and visual styles.

**Tech Stack:** Next.js 16, React 19, Tailwind CSS v4, shadcn/ui, TypeScript

---

## File Structure

| File | Responsibility |
|------|---------------|
| `src/app/globals.css` | CSS custom properties, Tailwind theme mapping, dark mode |
| `src/components/layout/sidebar.tsx` | Desktop sidebar navigation with active states |
| `src/components/layout/app-header.tsx` | Top header bar with user avatar dropdown |
| `src/components/layout/bottom-nav.tsx` | Mobile bottom tab navigation |
| `src/app/(app)/layout.tsx` | App shell layout composing sidebar, header, bottom nav, main content |
| `src/components/ui/button.tsx` | shadcn/ui button with CVA variants |
| `src/components/ui/card.tsx` | shadcn/ui card wrapper and subcomponents |
| `src/components/ui/badge.tsx` | shadcn/ui badge with status color variants |
| `src/components/ui/input.tsx` | shadcn/ui text input with focus styles |
| `src/components/ui/table.tsx` | shadcn/ui table with header/hover styles |

---

### Task 1: Update globals.css Theme Tokens

**Files:**
- Modify: `src/app/globals.css`

- [ ] **Step 1: Replace :root CSS custom properties**

Replace the entire `:root` block (lines 51-84) with the new OKLCH-based tokens:

```css
:root {
  --background: oklch(98% 0.005 250);
  --foreground: oklch(22% 0.02 240);
  --card: oklch(100% 0 0);
  --card-foreground: oklch(22% 0.02 240);
  --popover: oklch(100% 0 0);
  --popover-foreground: oklch(22% 0.02 240);
  --primary: #2563eb;
  --primary-foreground: oklch(100% 0 0);
  --secondary: oklch(97% 0 0);
  --secondary-foreground: oklch(22% 0.02 240);
  --muted: oklch(97% 0 0);
  --muted-foreground: oklch(50% 0.018 240);
  --accent: oklch(97% 0 0);
  --accent-foreground: oklch(22% 0.02 240);
  --destructive: oklch(65% 0.22 25);
  --destructive-foreground: oklch(100% 0 0);
  --border: oklch(90% 0.008 240);
  --input: oklch(90% 0.008 240);
  --ring: #2563eb;
  --radius: 0.5rem;
  --chart-1: oklch(0.646 0.222 41.116);
  --chart-2: oklch(0.6 0.118 184.704);
  --chart-3: oklch(0.398 0.07 227.392);
  --chart-4: oklch(0.828 0.189 84.429);
  --chart-5: oklch(0.769 0.188 70.08);
  --sidebar: oklch(98% 0.005 250);
  --sidebar-foreground: oklch(22% 0.02 240);
  --sidebar-primary: #2563eb;
  --sidebar-primary-foreground: oklch(100% 0 0);
  --sidebar-accent: oklch(97% 0 0);
  --sidebar-accent-foreground: oklch(22% 0.02 240);
  --sidebar-border: oklch(90% 0.008 240);
  --sidebar-ring: #2563eb;
}
```

- [ ] **Step 2: Update dark mode tokens**

Replace the entire `.dark` block (lines 86-118) with harmonized dark values:

```css
.dark {
  --background: oklch(15% 0.02 240);
  --foreground: oklch(98% 0.005 250);
  --card: oklch(20% 0.02 240);
  --card-foreground: oklch(98% 0.005 250);
  --popover: oklch(20% 0.02 240);
  --popover-foreground: oklch(98% 0.005 250);
  --primary: #3b82f6;
  --primary-foreground: oklch(100% 0 0);
  --secondary: oklch(25% 0.02 240);
  --secondary-foreground: oklch(98% 0.005 250);
  --muted: oklch(25% 0.02 240);
  --muted-foreground: oklch(65% 0.02 240);
  --accent: oklch(25% 0.02 240);
  --accent-foreground: oklch(98% 0.005 250);
  --destructive: oklch(70% 0.191 22.216);
  --destructive-foreground: oklch(100% 0 0);
  --border: oklch(30% 0.02 240);
  --input: oklch(30% 0.02 240);
  --ring: #3b82f6;
  --chart-1: oklch(0.55 0.155 38);
  --chart-2: oklch(0.5 0.15 170);
  --chart-3: oklch(0.35 0.08 210);
  --chart-4: oklch(0.75 0.17 70);
  --chart-5: oklch(0.68 0.16 60);
  --sidebar: oklch(18% 0.02 240);
  --sidebar-foreground: oklch(98% 0.005 250);
  --sidebar-primary: #3b82f6;
  --sidebar-primary-foreground: oklch(100% 0 0);
  --sidebar-accent: oklch(25% 0.02 240);
  --sidebar-accent-foreground: oklch(98% 0.005 250);
  --sidebar-border: oklch(30% 0.02 240);
  --sidebar-ring: #3b82f6;
}
```

- [ ] **Step 3: Update @theme inline block**

Replace the `@theme inline` block (lines 7-49) with updated mappings:

```css
@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --font-sans: -apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', system-ui, sans-serif;
  --font-mono: 'JetBrains Mono', 'IBM Plex Mono', ui-monospace, Menlo, monospace;
  --font-heading: -apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', system-ui, sans-serif;
  --color-sidebar-ring: var(--sidebar-ring);
  --color-sidebar-border: var(--sidebar-border);
  --color-sidebar-accent-foreground: var(--sidebar-accent-foreground);
  --color-sidebar-accent: var(--sidebar-accent);
  --color-sidebar-primary-foreground: var(--sidebar-primary-foreground);
  --color-sidebar-primary: var(--sidebar-primary);
  --color-sidebar-foreground: var(--sidebar-foreground);
  --color-sidebar: var(--sidebar);
  --color-chart-5: var(--chart-5);
  --color-chart-4: var(--chart-4);
  --color-chart-3: var(--chart-3);
  --color-chart-2: var(--chart-2);
  --color-chart-1: var(--chart-1);
  --color-ring: var(--ring);
  --color-input: var(--input);
  --color-border: var(--border);
  --color-destructive: var(--destructive);
  --color-accent-foreground: var(--accent-foreground);
  --color-accent: var(--accent);
  --color-muted-foreground: var(--muted-foreground);
  --color-muted: var(--muted);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-secondary: var(--secondary);
  --color-primary-foreground: var(--primary-foreground);
  --color-primary: var(--primary);
  --color-popover-foreground: var(--popover-foreground);
  --color-popover: var(--popover);
  --color-card-foreground: var(--card-foreground);
  --color-card: var(--card);
  --radius-sm: calc(var(--radius) * 0.5);
  --radius-md: calc(var(--radius) * 0.75);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) * 1.25);
  --radius-2xl: calc(var(--radius) * 1.5);
  --radius-3xl: calc(var(--radius) * 2);
  --radius-4xl: calc(var(--radius) * 2.5);
}
```

- [ ] **Step 4: Verify globals.css compiles**

Run: `npx tailwindcss -i src/app/globals.css -o /tmp/test.css --postcss`
Expected: No errors, CSS output generated

- [ ] **Step 5: Commit**

```bash
git add src/app/globals.css
git commit -m "feat(design): update CSS theme tokens with OKLCH color system"
```

---

### Task 2: Update Sidebar Component

**Files:**
- Modify: `src/components/layout/sidebar.tsx`

- [ ] **Step 1: Update sidebar styles**

Replace the entire file content:

```tsx
"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { NAV_ITEMS } from "@/lib/utils/constants"
import {
  LayoutDashboard, Wrench, ClipboardList, CalendarCheck,
  Package, BarChart3, Settings
} from "lucide-react"

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  LayoutDashboard, Wrench, ClipboardList, CalendarCheck, Package, BarChart3, Settings,
}

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="hidden h-screen w-64 flex-col border-r bg-card lg:flex">
      <div className="px-4 py-6">
        <Link href="/dashboard" className="px-2 text-xl font-bold text-primary">
          eBiomed
        </Link>
      </div>
      <nav className="flex flex-1 flex-col gap-1 px-4 py-4">
        {NAV_ITEMS.map((item) => {
          const Icon = iconMap[item.icon]
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/")
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary/[0.08] font-semibold text-primary"
                  : "text-muted-foreground hover:bg-background hover:text-foreground"
              )}
            >
              {Icon && <Icon className="h-5 w-5" />}
              {item.label}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
```

- [ ] **Step 2: Verify sidebar renders**

Run: `npm run dev`
Navigate to: `http://localhost:3000/dashboard`
Expected: Sidebar shows with blue logo, nav items have correct hover/active states

- [ ] **Step 3: Commit**

```bash
git add src/components/layout/sidebar.tsx
git commit -m "feat(design): restyle sidebar with new theme tokens"
```

---

### Task 3: Update AppHeader Component

**Files:**
- Modify: `src/components/layout/app-header.tsx`

- [ ] **Step 1: Update header styles**

Replace the outer `header` className on line 17:

From:
```tsx
<header className="flex h-16 items-center justify-between border-b bg-white px-4 lg:px-6">
```

To:
```tsx
<header className="flex h-16 items-center justify-between border-b bg-card px-4 lg:px-8">
```

No other changes needed — the user avatar dropdown and sign-out form remain as-is.

- [ ] **Step 2: Verify header renders**

Run: `npm run dev`
Navigate to: `http://localhost:3000/dashboard`
Expected: Header has white background with subtle border, user dropdown works

- [ ] **Step 3: Commit**

```bash
git add src/components/layout/app-header.tsx
git commit -m "feat(design): update app header background and border colors"
```

---

### Task 4: Update BottomNav Component

**Files:**
- Modify: `src/components/layout/bottom-nav.tsx`

- [ ] **Step 1: Update bottom nav styles**

Replace the entire file content:

```tsx
"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { Home, Wrench, ClipboardList, CalendarCheck, Package } from "lucide-react"

const BOTTOM_ITEMS = [
  { href: "/dashboard", label: "Home", icon: Home },
  { href: "/equipment", label: "Equip", icon: Wrench },
  { href: "/work-orders", label: "WOs", icon: ClipboardList },
  { href: "/pm-schedules", label: "PMs", icon: CalendarCheck },
  { href: "/parts", label: "Parts", icon: Package },
]

export function BottomNav() {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 flex h-16 border-t bg-card lg:hidden">
      {BOTTOM_ITEMS.map((item) => {
        const isActive = pathname === item.href || pathname.startsWith(item.href + "/")
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex flex-1 flex-col items-center justify-center gap-1 text-xs",
              isActive ? "font-medium text-primary" : "text-muted-foreground"
            )}
          >
            <item.icon className="h-5 w-5" />
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}
```

- [ ] **Step 2: Verify bottom nav on mobile**

Open browser dev tools, toggle device toolbar to iPhone SE (375px width)
Navigate to: `http://localhost:3000/dashboard`
Expected: Bottom nav shows at bottom, active item is blue, inactive items are muted gray

- [ ] **Step 3: Commit**

```bash
git add src/components/layout/bottom-nav.tsx
git commit -m "feat(design): update bottom nav with new theme colors"
```

---

### Task 5: Update App Layout

**Files:**
- Modify: `src/app/(app)/layout.tsx`

- [ ] **Step 1: Update layout padding and background**

Replace the entire file content:

```tsx
import { Sidebar } from "@/components/layout/sidebar"
import { BottomNav } from "@/components/layout/bottom-nav"
import { AppHeader } from "@/components/layout/app-header"

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex flex-1 flex-col">
        <AppHeader />
        <main className="flex-1 overflow-auto bg-background p-8 pb-20 lg:p-8 lg:pb-8">
          {children}
        </main>
      </div>
      <BottomNav />
    </div>
  )
}
```

- [ ] **Step 2: Verify layout renders**

Run: `npm run dev`
Navigate to: `http://localhost:3000/dashboard`
Expected: Content area has light gray background, proper padding on desktop and mobile

- [ ] **Step 3: Commit**

```bash
git add src/app/(app)/layout.tsx
git commit -m "feat(design): update app layout background and padding"
```

---

### Task 6: Update Button Component

**Files:**
- Modify: `src/components/ui/button.tsx`

- [ ] **Step 1: Update CVA variant styles**

Replace the `buttonVariants` CVA object. Keep the same structure but update styles:

```tsx
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all duration-150 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground border border-primary shadow-none hover:brightness-110",
        destructive:
          "bg-destructive text-destructive-foreground border border-destructive shadow-none hover:brightness-110",
        outline:
          "border border-border bg-transparent text-foreground shadow-none hover:bg-background hover:text-foreground",
        secondary:
          "bg-secondary text-secondary-foreground border border-transparent shadow-none hover:bg-secondary/80",
        ghost: "hover:bg-background hover:text-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-10 rounded-md px-8",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)
```

- [ ] **Step 2: Verify buttons render correctly**

Check buttons on:
- `/dashboard` (stats cards may have actions)
- `/equipment` (new equipment button)
- `/work-orders` (new work order button)

Expected: Primary buttons are blue, outline buttons have subtle borders, hover states work

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/button.tsx
git commit -m "feat(design): update button variants with new theme colors and transitions"
```

---

### Task 7: Update Card Component

**Files:**
- Modify: `src/components/ui/card.tsx`

- [ ] **Step 1: Read current card component**

Read `src/components/ui/card.tsx` to see current structure.

- [ ] **Step 2: Update Card wrapper styles**

Update the `Card` component's className to include the shadow:

From:
```tsx
const Card = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "rounded-xl border bg-card text-card-foreground shadow",
      className
    )}
    {...props}
  />
))
```

To:
```tsx
const Card = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "rounded-lg border border-border bg-card text-card-foreground shadow-[0_1px_2px_0_rgba(0,0,0,0.05)]",
      className
    )}
    {...props}
  />
))
```

If the current structure differs (e.g., uses `rounded-xl`), adjust accordingly to match the above.

- [ ] **Step 3: Verify cards render**

Navigate to: `http://localhost:3000/dashboard`
Expected: Stats cards and alert cards have subtle shadow, 8px radius, proper borders

- [ ] **Step 4: Commit**

```bash
git add src/components/ui/card.tsx
git commit -m "feat(design): update card with subtle shadow and 8px radius"
```

---

### Task 8: Update Badge Component

**Files:**
- Modify: `src/components/ui/badge.tsx`

- [ ] **Step 1: Read current badge component**

Read `src/components/ui/badge.tsx` to see current CVA structure.

- [ ] **Step 2: Update badge variants**

Replace the `badgeVariants` CVA to include status color variants:

```tsx
import { cva, type VariantProps } from "class-variance-authority"
import * as React from "react"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center justify-center rounded-full border px-3 py-1 text-xs font-medium w-fit whitespace-nowrap shrink-0 transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-muted text-muted-foreground hover:bg-muted/80",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive:
          "border-transparent bg-destructive/10 text-destructive hover:bg-destructive/20",
        outline: "text-foreground border-border",
        success:
          "border-transparent bg-[oklch(58%_0.16_145)]/10 text-[oklch(40%_0.15_145)] hover:bg-[oklch(58%_0.16_145)]/20",
        warning:
          "border-transparent bg-[oklch(75%_0.18_85)]/10 text-[oklch(50%_0.18_85)] hover:bg-[oklch(75%_0.18_85)]/20",
        info:
          "border-transparent bg-[oklch(70%_0.15_230)]/10 text-[oklch(50%_0.15_230)] hover:bg-[oklch(70%_0.15_230)]/20",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
```

- [ ] **Step 3: Verify badges render**

Navigate to pages with badges:
- `/equipment` (status badges)
- `/work-orders` (priority/status badges)

Expected: Status badges show correct background/text color combinations

- [ ] **Step 4: Commit**

```bash
git add src/components/ui/badge.tsx
git commit -m "feat(design): add status color variants to badge component"
```

---

### Task 9: Update Input Component

**Files:**
- Modify: `src/components/ui/input.tsx`

- [ ] **Step 1: Update input styles**

Replace the Input component's className. Keep the `React.forwardRef` structure:

```tsx
const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-9 w-full rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground shadow-none transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-[-1px] focus-visible:border-primary disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
```

- [ ] **Step 2: Verify input focus styles**

Navigate to a page with forms:
- `/work-orders/new`
- `/equipment/new`

Click on an input field.
Expected: Blue focus ring (`outline-2 outline-primary outline-offset-[-1px]`), border turns blue

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/input.tsx
git commit -m "feat(design): update input focus styles with blue ring and card background"
```

---

### Task 10: Update Table Component

**Files:**
- Modify: `src/components/ui/table.tsx`

- [ ] **Step 1: Read current table component**

Read `src/components/ui/table.tsx` to see current subcomponent structure.

- [ ] **Step 2: Update table subcomponent styles**

Update each subcomponent:

**TableHeader:**
```tsx
const TableHeader = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <thead ref={ref} className={cn("[&_tr]:border-b", className)} {...props} />
))
```

**TableBody:**
```tsx
const TableBody = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tbody
    ref={ref}
    className={cn("[&_tr:last-child]:border-0", className)}
    {...props}
  />
))
```

**TableRow:**
```tsx
const TableRow = React.forwardRef<
  HTMLTableRowElement,
  React.HTMLAttributes<HTMLTableRowElement>
>(({ className, ...props }, ref) => (
  <tr
    ref={ref}
    className={cn(
      "border-b border-border transition-colors hover:bg-background data-[state=selected]:bg-muted",
      className
    )}
    {...props}
  />
))
```

**TableHead:**
```tsx
const TableHead = React.forwardRef<
  HTMLTableCellElement,
  React.ThHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <th
    ref={ref}
    className={cn(
      "h-10 px-4 py-3 text-left align-middle font-medium text-muted-foreground text-xs uppercase tracking-wider [&:has([role=checkbox])]:pr-0",
      className
    )}
    {...props}
  />
))
```

**TableCell:**
```tsx
const TableCell = React.forwardRef<
  HTMLTableCellElement,
  React.TdHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <td
    ref={ref}
    className={cn(
      "p-4 align-middle text-sm [&:has([role=checkbox])]:pr-0",
      className
    )}
    {...props}
  />
))
```

If the current file uses different className patterns, map the style changes to the existing structure while preserving all React.forwardRef and ...props spreading.

- [ ] **Step 3: Verify table rendering**

Navigate to pages with tables:
- `/equipment`
- `/work-orders`
- `/parts`

Expected: Table headers are muted gray with uppercase/tracking, rows have hover background, borders are subtle

- [ ] **Step 4: Commit**

```bash
git add src/components/ui/table.tsx
git commit -m "feat(design): update table header and row hover styles"
```

---

## Self-Review

### Spec Coverage Check

| Spec Section | Task | Status |
|-------------|------|--------|
| CSS Theme System (Section 2) | Task 1 | Covered |
| Sidebar (Section 3.1) | Task 2 | Covered |
| AppHeader (Section 3.2) | Task 3 | Covered |
| BottomNav (Section 3.3) | Task 4 | Covered |
| App Layout (Section 3.4) | Task 5 | Covered |
| Button (Section 4.1) | Task 6 | Covered |
| Card (Section 4.2) | Task 7 | Covered |
| Badge (Section 4.3) | Task 8 | Covered |
| Input (Section 4.4) | Task 9 | Covered |
| Table (Section 4.5) | Task 10 | Covered |
| Page Containers (Section 5) | Task 5 | Covered |

### Placeholder Scan

No placeholders found. All steps include exact code, file paths, and commands.

### Type Consistency

All component props and ref types match the existing shadcn/ui patterns. No type mismatches introduced.

---

## Testing Checklist (Post-Implementation)

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
