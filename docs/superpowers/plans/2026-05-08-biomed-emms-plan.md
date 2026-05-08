# Biomedical EMMS Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a cloud-hosted biomedical CMMS with corrective maintenance, preventive maintenance, asset management, and parts inventory for a single-hospital department (~5-20 techs, ~2K-10K devices).

**Architecture:** Next.js 15 App Router frontend with server actions as the API layer, Supabase for auth, PostgreSQL, and storage, shadcn/ui + TailwindCSS for responsive UI (desktop sidebar, mobile bottom nav).

**Tech Stack:** Next.js 15, TypeScript, TailwindCSS, shadcn/ui, Supabase JS client, Supabase Auth, Supabase Storage, Zod, date-fns, Recharts

---

## File Structure Map

```
eBiomed/
  .env.local                          # Supabase keys (gitignored)
  next.config.ts
  tailwind.config.ts
  tsconfig.json
  package.json
  supabase/
    migrations/                       # SQL migration files
    seed.sql                          # Demo data
  src/
    app/
      layout.tsx                      # Root layout with providers
      page.tsx                        # Redirect to /dashboard
      globals.css                     # Tailwind + shadcn theming
      (auth)/
        login/
          page.tsx                    # Login form
        auth/
          callback/
            route.ts                  # Auth callback handler
      (app)/                          # Protected layout group
        layout.tsx                    # Sidebar + header + content shell
        dashboard/
          page.tsx                    # Stats + alerts
        equipment/
          page.tsx                    # Equipment list
          new/
            page.tsx                  # Create equipment
          [id]/
            page.tsx                  # Equipment detail
        work-orders/
          page.tsx                    # Work order list
          new/
            page.tsx                  # Create work order
          [id]/
            page.tsx                  # Work order detail
        pm-schedules/
          page.tsx                    # PM schedule list + calendar
          [id]/
            page.tsx                  # PM schedule detail + checklist
        parts/
          page.tsx                    # Parts inventory
        reports/
          page.tsx                    # Reports dashboard
        settings/
          page.tsx                    # Users, departments, locations
    components/
      ui/                             # shadcn/ui generated components
      layout/
        sidebar.tsx
        bottom-nav.tsx
        app-header.tsx
      equipment/
        equipment-table.tsx
        equipment-form.tsx
        equipment-info-tab.tsx
        equipment-history-tab.tsx
        equipment-pm-tab.tsx
      work-orders/
        wo-table.tsx
        wo-form.tsx
        wo-detail-card.tsx
      pm-schedules/
        pm-table.tsx
      parts/
        parts-table.tsx
      dashboard/
        stats-cards.tsx
        activity-feed.tsx
        overdue-pm-alert.tsx
        low-stock-alert.tsx
      reports/
        compliance-chart.tsx
      shared/
        status-badge.tsx
        priority-badge.tsx
        empty-state.tsx
    lib/
      supabase/
        client.ts
        server.ts
        middleware.ts
      schemas/
        equipment.ts
        work-order.ts
        pm-schedule.ts
        parts.ts
        profile.ts
      actions/
        equipment.ts
        work-orders.ts
        pm-schedules.ts
        parts.ts
        profiles.ts
      types/
        index.ts
      utils/
        format.ts
        constants.ts
        cn.ts
```

---

## Milestone 1: Project Scaffold & Supabase Setup

### Task 1.1: Scaffold Next.js project with dependencies

**Files:**
- Create: `package.json`, `next.config.ts`, `tailwind.config.ts`, `tsconfig.json`

- [ ] **Step 1: Create Next.js app**

```bash
npx create-next-app@latest eBiomed --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm
```

- [ ] **Step 2: Install additional dependencies**

```bash
cd eBiomed && npm install @supabase/ssr @supabase/supabase-js zod react-hook-form @hookform/resolvers date-fns recharts lucide-react class-variance-authority clsx tailwind-merge
```

- [ ] **Step 3: Initialize shadcn/ui**

```bash
npx shadcn@latest init -d
```

- [ ] **Step 4: Add shadcn/ui components**

```bash
npx shadcn@latest add button card input label select table badge dialog dropdown-menu avatar tabs calendar sheet skeleton toast separator textarea
```

- [ ] **Step 5: Create `src/lib/utils/cn.ts`**

```typescript
import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

- [ ] **Step 6: Create `.env.local`**

```
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

- [ ] **Step 7: Verify dev server starts** — Run `npm run dev`, expected: Next.js starts on localhost:3000

- [ ] **Step 8: Commit**

```bash
git add -A && git commit -m "feat: scaffold Next.js project with shadcn/ui and Supabase deps"
```

---

### Task 1.2: Set up Supabase project and database schema

**Files:**
- Create: `supabase/migrations/0001_initial_schema.sql`

- [ ] **Step 1: Create Supabase project** at https://supabase.com — record project URL and anon key in `.env.local`

- [ ] **Step 2: Install Supabase CLI**

```bash
npm install -D supabase && npx supabase init
```

- [ ] **Step 3: Create `supabase/migrations/0001_initial_schema.sql`** with the full schema (refer to spec sections 4.1-4.6 for all table definitions including enums, indexes, and foreign keys). Key tables: profiles, equipment, work_orders, pm_schedules, parts, parts_usage.

- [ ] **Step 4: Create `supabase/migrations/0002_parts_trigger.sql`** with triggers to decrement/restore parts quantity on parts_usage insert/delete (refer to Task 1.2 Step 6 in detailed reference).

- [ ] **Step 5: Link and push schema to Supabase**

```bash
npx supabase link --project-ref <your-project-ref>
npx supabase db push
```

- [ ] **Step 6: Verify tables exist** — check in Supabase SQL editor: `select table_name from information_schema.tables where table_schema = 'public';` Expected: profiles, equipment, work_orders, pm_schedules, parts, parts_usage

- [ ] **Step 7: Commit**

```bash
git add supabase/ && git commit -m "feat: add database schema and parts trigger"
```

---

### Task 1.3: Supabase client setup

**Files:**
- Create: `src/lib/supabase/client.ts`, `src/lib/supabase/server.ts`, `src/lib/supabase/middleware.ts`, `src/middleware.ts`

- [ ] **Step 1: Create browser client `src/lib/supabase/client.ts`** — uses `createBrowserClient` from `@supabase/ssr` with env vars

- [ ] **Step 2: Create server client `src/lib/supabase/server.ts`** — uses `createServerClient` with cookie-based session from `next/headers`

- [ ] **Step 3: Create auth middleware `src/lib/supabase/middleware.ts`** — refreshes session via cookies, redirects unauthenticated users to /login, authenticated users on /login to /dashboard

- [ ] **Step 4: Create Next.js middleware `src/middleware.ts`** — exports middleware function wrapping updateSession, matches all routes except static assets

(See spec and Supabase Next.js SSR docs for exact implementations.)

- [ ] **Step 5: Commit**

```bash
git add src/lib/supabase/ src/middleware.ts && git commit -m "feat: add Supabase client, server, and auth middleware"
```

---

## Milestone 2: Auth System

### Task 2.1: Login page + auth actions

**Files:**
- Create: `src/app/(auth)/login/page.tsx`, `src/app/(auth)/auth/callback/route.ts`, `src/lib/actions/profiles.ts`

- [ ] **Step 1: Create login page** — shadcn/ui card with email/password form, toggleable signup mode. Uses shadcn `Card`, `Input`, `Label`, `Button` components. Signup form includes fullName field. Submit uses server action formAction.

- [ ] **Step 2: Create auth callback route** — exchanges OAuth code for session, redirects to /dashboard

- [ ] **Step 3: Create profile actions `src/lib/actions/profiles.ts`** — exports `login(formData)`, `signup(formData)`, `signout()`, `getCurrentUser()`. Login uses `supabase.auth.signInWithPassword`. Signup creates auth user then inserts profile row. Signout calls `supabase.auth.signOut()`. getCurrentUser fetches user + profile joined data.

- [ ] **Step 4: Manual test** — Create user in Supabase Auth dashboard, insert matching profile row, sign in, verify redirect to /dashboard

- [ ] **Step 5: Commit**

```bash
git add src/app/\(auth\)/ src/lib/actions/profiles.ts && git commit -m "feat: add login page, auth callback, and profile actions"
```

---

## Milestone 3: App Layout Shell

### Task 3.1: Protected app layout with sidebar and bottom nav

**Files:**
- Create: `src/app/(app)/layout.tsx`, `src/components/layout/sidebar.tsx`, `src/components/layout/bottom-nav.tsx`, `src/components/layout/app-header.tsx`, `src/lib/utils/constants.ts`

- [ ] **Step 1: Create constants** — `NAV_ITEMS` array with href, label, icon for: Dashboard, Equipment, Work Orders, PM Schedule, Parts, Reports, Settings

- [ ] **Step 2: Create sidebar** — hidden on mobile (hidden lg:flex), shows nav links with active state highlighting using `usePathname()`, lucide-react icons, app branding at top

- [ ] **Step 3: Create bottom nav** — fixed bottom bar visible on mobile (lg:hidden), 5 primary nav items: Home, Equipment, WOs, PMs, Parts with lucide icons

- [ ] **Step 4: Create app header** — shows hamburger menu on mobile, user avatar/name dropdown with signout, uses `getCurrentUser()` for profile data

- [ ] **Step 5: Create app layout** — wraps children with Sidebar (left), header + main content area, BottomNav (mobile). Main has `pb-20 lg:pb-6` for bottom nav clearance.

- [ ] **Step 6: Verify** — visit /dashboard, see layout with sidebar (desktop) or bottom nav (mobile)

- [ ] **Step 7: Commit**

```bash
git add src/components/layout/ src/app/\(app\)/layout.tsx src/lib/utils/constants.ts && git commit -m "feat: add app layout shell with sidebar, bottom nav, and header"
```

---

## Milestone 4: Types, Schemas, and Utilities

### Task 4.1: Zod schemas, TypeScript types, and formatters

**Files:**
- Create: `src/lib/schemas/equipment.ts`, `src/lib/schemas/work-order.ts`, `src/lib/schemas/pm-schedule.ts`, `src/lib/schemas/parts.ts`, `src/lib/schemas/profile.ts`, `src/lib/types/index.ts`, `src/lib/utils/format.ts`

- [ ] **Step 1: Create equipment schema** — `equipmentSchema` with fields matching the equipment table. Enum: `equipmentStatusEnum`. Exports `EquipmentFormData` type.

- [ ] **Step 2: Create work order schemas** — `workOrderSchema` (create), `workOrderUpdateSchema` (status/assignee updates). Enums: type, priority, status.

- [ ] **Step 3: Create PM schedule schema** — `pmScheduleSchema` including `checklistItemSchema` (id, text, completed). `frequency_days` as coerce number.

- [ ] **Step 4: Create parts schemas** — `partSchema` (create), `partRestockSchema` (id + quantity), `partsUsageSchema` (wo_id, part_id, quantity_used).

- [ ] **Step 5: Create profile schema** — `profileSchema`, `profileUpdateSchema`, role enum.

- [ ] **Step 6: Create TypeScript types** — interfaces for Equipment, WorkOrder, PMSchedule, ChecklistItem, Part, PartsUsage, Profile matching spec section 4 table definitions exactly.

- [ ] **Step 7: Create formatters** — `formatDate`, `formatDateTime`, `formatRelative` (using date-fns), `getPMStatus` (overdue/due/upcoming/none), `statusColor`, `priorityColor` (Tailwind color classes).

- [ ] **Step 8: Commit**

```bash
git add src/lib/schemas/ src/lib/types/ src/lib/utils/format.ts && git commit -m "feat: add Zod schemas, TypeScript types, and formatters"
```

---

## Milestone 5: Equipment Module

### Task 5.1: Equipment server actions

**Files:**
- Create: `src/lib/actions/equipment.ts`

- [ ] **Step 1: Create equipment actions** — exports `createEquipment(formData)`, `updateEquipment(id, formData)`, `getEquipment()`, `getEquipmentById(id)`. insert/update use Zod validation with error redirects. getEquipment returns all ordered by created_at desc. getEquipmentById returns single item or null.

- [ ] **Step 2: Commit**

```bash
git add src/lib/actions/equipment.ts && git commit -m "feat: add equipment CRUD server actions"
```

### Task 5.2: Equipment list page with table

**Files:**
- Create: `src/app/(app)/equipment/page.tsx`, `src/components/equipment/equipment-table.tsx`, `src/components/shared/status-badge.tsx`, `src/components/shared/empty-state.tsx`

- [ ] **Step 1: Create StatusBadge** — renders colored pill using `statusColor()` utility, displays status text with underscores replaced by spaces

- [ ] **Step 2: Create EmptyState** — centered icon + title + description + optional action slot

- [ ] **Step 3: Create EquipmentTable** — shadcn Table showing tag_number (linked to detail), name, manufacturer, department, location, StatusBadge, install date. Handles empty state.

- [ ] **Step 4: Create equipment list page** — server component with "Add Equipment" button linking to /equipment/new, Suspense-wrapped EquipmentTable with Skeleton loading state

- [ ] **Step 5: Verify** — visit /equipment, see table (empty initially), "Add Equipment" button

- [ ] **Step 6: Commit**

```bash
git add src/app/\(app\)/equipment/ src/components/equipment/ src/components/shared/ && git commit -m "feat: add equipment list page with table"
```

### Task 5.3: Create equipment form

**Files:**
- Create: `src/app/(app)/equipment/new/page.tsx`, `src/components/equipment/equipment-form.tsx`

- [ ] **Step 1: Create EquipmentForm** — client component with all equipment fields (tag_number*, name*, serial, model, manufacturer, category, department, location, status select, install_date, warranty_expiry, notes textarea). Shows error alert from search params. Submit uses formAction (createEquipment or updateEquipment). Zod validation on server action catches errors.

- [ ] **Step 2: Create new equipment page** — renders back link + EquipmentForm in a card

- [ ] **Step 3: Test** — create an equipment entry via form, verify it appears in list

- [ ] **Step 4: Commit**

```bash
git add src/app/\(app\)/equipment/new/ src/components/equipment/equipment-form.tsx && git commit -m "feat: add equipment create form"
```

### Task 5.4: Equipment detail page with tabs

**Files:**
- Create: `src/app/(app)/equipment/[id]/page.tsx`, `src/components/equipment/equipment-info-tab.tsx`, `src/components/equipment/equipment-history-tab.tsx`, `src/components/equipment/equipment-pm-tab.tsx`, `src/components/shared/priority-badge.tsx`

- [ ] **Step 1: Create EquipmentInfoTab** — grid display of all equipment fields with labels

- [ ] **Step 2: Create EquipmentHistoryTab** — async component fetching work_orders for equipment_id, displayed as linked cards with status badge + priority badge + type + description + date

- [ ] **Step 3: Create EquipmentPMTab** — async component fetching active pm_schedules for equipment, displayed as linked cards with frequency, last completed, next due, overdue/due/upcoming status

- [ ] **Step 4: Create PriorityBadge** — renders colored pill using `priorityColor()` utility

- [ ] **Step 5: Create detail page** — fetches equipment by id, shows back link, name + status, tabs (Info / Work History / PM Schedules), edit button

- [ ] **Step 6: Verify** — click equipment row from list, see detail with 3 tabs

- [ ] **Step 7: Commit**

```bash
git add src/app/\(app\)/equipment/\[id\]/ src/components/equipment/ src/components/shared/priority-badge.tsx && git commit -m "feat: add equipment detail page with info, history, and PM tabs"
```

---

## Milestone 6: Work Orders Module

### Task 6.1: Work order server actions

**Files:**
- Create: `src/lib/actions/work-orders.ts`

- [ ] **Step 1: Create work order actions** — exports:
  - `createWorkOrder(formData)` — Zod validates, inserts with created_by from getCurrentUser, sets status="open"
  - `getWorkOrders()` — selects all with joined equipment, ordered by created_at desc
  - `getWorkOrderById(id)` — single WO with equipment, assigned_profile, created_profile joins
  - `updateWorkOrderStatus(id, formData)` — updates status, sets started_at when status="in_progress", sets completed_at when status="completed", updates equipment status to under_repair/active accordingly
  - `getAssignedWorkOrders(userId)` — WOs for a specific tech

- [ ] **Step 2: Commit**

```bash
git add src/lib/actions/work-orders.ts && git commit -m "feat: add work order server actions with status management"
```

### Task 6.2: Work order list page

**Files:**
- Create: `src/app/(app)/work-orders/page.tsx`, `src/components/work-orders/wo-table.tsx`

- [ ] **Step 1: Create WorkOrderTable** — shadcn Table showing equipment name (linked), type, PriorityBadge, StatusBadge, truncated description, relative timestamp

- [ ] **Step 2: Create WO list page** — "New Work Order" button, Suspense-wrapped table

- [ ] **Step 3: Commit**

```bash
git add src/app/\(app\)/work-orders/page.tsx src/components/work-orders/wo-table.tsx && git commit -m "feat: add work order list page"
```

### Task 6.3: Create work order form

**Files:**
- Create: `src/app/(app)/work-orders/new/page.tsx`, `src/components/work-orders/wo-form.tsx`

- [ ] **Step 1: Create WorkOrderForm** — client component with:
  - Equipment Select dropdown (fetches non-retired equipment from Supabase client)
  - Type Select (corrective/preventive)
  - Priority Select (low/medium/high/critical)
  - Description Textarea (required)
  - Error alert display from search params
  - Submit uses `formAction={createWorkOrder}`

- [ ] **Step 2: Create new WO page** — back link + WorkOrderForm in card

- [ ] **Step 3: Verify** — create a WO, verify it appears in list

- [ ] **Step 4: Commit**

```bash
git add src/app/\(app\)/work-orders/new/ src/components/work-orders/wo-form.tsx && git commit -m "feat: add work order create form"
```

### Task 6.4: Work order detail page

**Files:**
- Create: `src/app/(app)/work-orders/[id]/page.tsx`, `src/components/work-orders/wo-detail-card.tsx`

- [ ] **Step 1: Create WorkOrderDetailCard** — client component showing:
  - Grid of fields: equipment name/tag, type, PriorityBadge, StatusBadge, assigned to, created by, created/started/completed dates, downtime
  - Description and resolution notes
  - Status update form (hidden if completed/cancelled): status select (in_progress/on_hold/completed/cancelled), resolution notes textarea, submit button. Uses `formAction={updateWorkOrderStatus.bind(null, wo.id)}`

- [ ] **Step 2: Create WO detail page** — fetches WO by id, 404 if not found, renders WorkOrderDetailCard

- [ ] **Step 3: Commit**

```bash
git add src/app/\(app\)/work-orders/\[id\]/ src/components/work-orders/wo-detail-card.tsx && git commit -m "feat: add work order detail page with status updates"
```

---

## Milestone 7: PM Schedules Module

### Task 7.1: PM schedule server actions

**Files:**
- Create: `src/lib/actions/pm-schedules.ts`

- [ ] **Step 1: Create PM actions** — exports:
  - `createPMSchedule(formData)` — validates with Zod, calculates next_due as now + frequency_days, inserts with JSON-stringified checklist
  - `getPMSchedules()` — all schedules with equipment join, ordered by next_due asc
  - `getPMScheduleById(id)` — single schedule with equipment
  - `startPMTask(pmScheduleId)` — creates a work_order (type: preventive, status: in_progress) linked to this schedule, redirects to the new WO
  - `completePMTask(workOrderId, pmScheduleId)` — updates last_completed to now, recalculates next_due

- [ ] **Step 2: Commit**

```bash
git add src/lib/actions/pm-schedules.ts && git commit -m "feat: add PM schedule server actions"
```

### Task 7.2: PM schedule list page

**Files:**
- Create: `src/app/(app)/pm-schedules/page.tsx`, `src/components/pm-schedules/pm-table.tsx`

- [ ] **Step 1: Create PMTable** — shadcn Table showing equipment name (linked), frequency, last completed, next due, status badge (overdue/due/upcoming/OK using getPMStatus), "Start PM" button (only for overdue/due/upcoming active schedules). Start PM uses `formAction={startPMTask.bind(null, pm.id)}`.

- [ ] **Step 2: Create PM schedules page** — Suspense-wrapped PMTable

- [ ] **Step 3: Commit**

```bash
git add src/app/\(app\)/pm-schedules/ src/components/pm-schedules/ && git commit -m "feat: add PM schedule list with start PM action"
```

---

## Milestone 8: Parts Inventory Module

### Task 8.1: Parts server actions

**Files:**
- Create: `src/lib/actions/parts.ts`

- [ ] **Step 1: Create parts actions** — exports:
  - `createPart(formData)` — Zod validates, inserts part
  - `getParts()` — all parts ordered by name
  - `restockPart(formData)` — reads current quantity, adds new quantity, updates
  - `consumeParts(formData)` — inserts into parts_usage, which triggers the parts decrement via database trigger

- [ ] **Step 2: Commit**

```bash
git add src/lib/actions/parts.ts && git commit -m "feat: add parts inventory server actions"
```

### Task 8.2: Parts inventory page

**Files:**
- Create: `src/app/(app)/parts/page.tsx`, `src/components/parts/parts-table.tsx`

- [ ] **Step 1: Create PartsTable** — shadcn Table showing name, part number, qty on hand, min threshold, low stock status badge (red if qty <= min), unit cost, location, and "Restock" button opening a Dialog with quantity input

- [ ] **Step 2: Create parts page** — "Add Part" button (Dialog with part form fields), Suspense-wrapped PartsTable

- [ ] **Step 3: Commit**

```bash
git add src/app/\(app\)/parts/ src/components/parts/ && git commit -m "feat: add parts inventory page with restock and add dialogs"
```

---

## Milestone 9: Dashboard Page

### Task 9.1: Dashboard with stats, alerts, and activity

**Files:**
- Create: `src/app/(app)/dashboard/page.tsx`, `src/components/dashboard/stats-cards.tsx`, `src/components/dashboard/activity-feed.tsx`, `src/components/dashboard/overdue-pm-alert.tsx`, `src/components/dashboard/low-stock-alert.tsx`

- [ ] **Step 1: Create StatsCards** — 4-card grid: Total Equipment (blue), Open Work Orders (orange), Overdue PMs (red), Low Stock Parts (yellow). Each card has lucide icon, label, and count.

- [ ] **Step 2: Create ActivityFeed** — list of 10 most recent work orders, each linking to detail page, showing equipment name, description, StatusBadge, relative timestamp

- [ ] **Step 3: Create OverduePMAlert** — red-tinted card listing overdue PM schedules with equipment name and due date. Hides when none overdue.

- [ ] **Step 4: Create LowStockAlert** — yellow-tinted card listing parts below threshold with name and qty/min display. Hides when none low.

- [ ] **Step 5: Create dashboard page** — server component that fetches all stats in parallel (equipment count, open WO count, PM schedules with equipment, low stock parts, recent WOs). Renders StatsCards, overdue+low-stock alerts side by side, and ActivityFeed.

- [ ] **Step 6: Verify** — visit /dashboard, see all widgets (seed some data first)

- [ ] **Step 7: Commit**

```bash
git add src/app/\(app\)/dashboard/ src/components/dashboard/ && git commit -m "feat: add dashboard with stats, overdue PMs, low stock, and activity"
```

---

## Milestone 10: Reports Page

### Task 10.1: Reports with charts and breakdowns

**Files:**
- Create: `src/app/(app)/reports/page.tsx`, `src/components/reports/compliance-chart.tsx`

- [ ] **Step 1: Create ComplianceChart** — Recharts PieChart showing completed vs pending PM schedules with green/gray colors. Handles zero state.

- [ ] **Step 2: Create reports page** — fetches: total PM count, completed PM count, equipment by status counts, work orders this month by status. Shows 4 cards in a grid: PM Compliance pie chart, Equipment by Status bar chart, Work Orders This Month breakdown, Summary stats (total equipment, active PMs, compliance rate %).

- [ ] **Step 3: Commit**

```bash
git add src/app/\(app\)/reports/ src/components/reports/ && git commit -m "feat: add reports page with PM compliance and status breakdowns"
```

---

## Milestone 11: Settings Page

### Task 11.1: Settings with user management

**Files:**
- Create: `src/app/(app)/settings/page.tsx`

- [ ] **Step 1: Create settings page** — shows user list table (name, role, department, phone) fetched from profiles. "Add User" button opens Dialog with signup form (fullName, email, password, role select, department). Uses `signup` server action from profiles.

- [ ] **Step 2: Commit**

```bash
git add src/app/\(app\)/settings/ && git commit -m "feat: add settings page with user management"
```

---

## Milestone 12: Seed Data and Polish

### Task 12.1: Database seed script

**Files:**
- Create: `supabase/seed.sql`

- [ ] **Step 1: Create seed data** — 10 sample equipment entries across different departments (ICU, ER, OR, Radiology, Nephrology), 8 sample parts with varying stock levels, PM schedules for each active equipment with checklist items. Refer to spec for exact data.

- [ ] **Step 2: Run seed SQL in Supabase SQL editor**

- [ ] **Step 3: Commit**

```bash
git add supabase/seed.sql && git commit -m "feat: add database seed data"
```

### Task 12.2: Mobile responsiveness polish

**Files:**
- Modify: All table components, form pages, dashboard

- [ ] **Step 1: Ensure all tables degrade to card layouts on mobile** — use hidden md:table-cell classes on non-essential columns

- [ ] **Step 2: Ensure forms are full-width on mobile** — grid-cols-1 on small screens

- [ ] **Step 3: Test at 375px and 768px viewport widths**

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "fix: polish mobile responsiveness across all pages"
```

### Task 12.3: Root layout and redirects

**Files:**
- Modify: `src/app/layout.tsx`, `src/app/page.tsx`

- [ ] **Step 1: Create root layout** — `src/app/layout.tsx` with html/body wrapper, global font, suppressHydrationWarning. No Supabase provider needed since we use @supabase/ssr with cookies.

- [ ] **Step 2: Create root page** — `src/app/page.tsx` redirects to `/dashboard`

- [ ] **Step 3: Commit**

```bash
git add src/app/layout.tsx src/app/page.tsx && git commit -m "feat: add root layout and dashboard redirect"
```

---

## Task Summary

| # | Task | Est. Time |
|---|------|-----------|
| 1.1 | Scaffold Next.js + shadcn/ui | 10 min |
| 1.2 | Supabase schema + triggers | 15 min |
| 1.3 | Supabase clients + middleware | 10 min |
| 2.1 | Login page + auth actions | 15 min |
| 3.1 | App layout shell | 15 min |
| 4.1 | Zod schemas + types + formatters | 15 min |
| 5.1 | Equipment server actions | 5 min |
| 5.2 | Equipment list page | 10 min |
| 5.3 | Create equipment form | 10 min |
| 5.4 | Equipment detail page | 15 min |
| 6.1 | WO server actions | 10 min |
| 6.2 | WO list page | 10 min |
| 6.3 | Create WO form | 10 min |
| 6.4 | WO detail page | 15 min |
| 7.1 | PM server actions | 10 min |
| 7.2 | PM list page | 10 min |
| 8.1 | Parts server actions | 10 min |
| 8.2 | Parts inventory page | 10 min |
| 9.1 | Dashboard page | 20 min |
| 10.1 | Reports page | 15 min |
| 11.1 | Settings page | 10 min |
| 12.1 | Seed data | 5 min |
| 12.2 | Mobile polish | 10 min |
| 12.3 | Root layout | 5 min |

**Total: ~4.5 hours**

---

## Notes

- All server actions use `"use server"` directive and should be called via `formAction` props or imported directly in server components
- Supabase JS client is used directly (no ORM). Queries use `.from(table).select().eq().order()` pattern
- RLS policies should be set in Supabase dashboard: techs can CRUD own WOs, admins CRUD all, viewers read-only
- All date fields are stored as ISO strings, formatted with date-fns for display
- The middleware handles auth redirects — no need for per-page auth checks
- For full code implementations and exact file contents, refer to the detailed code blocks in the original plan draft. This summarized plan references the spec for table schemas and data models.
