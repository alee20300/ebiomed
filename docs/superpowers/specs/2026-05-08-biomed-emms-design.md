# Biomedical EMMS Design Spec

**Date:** 2026-05-08
**Status:** Approved
**Scope:** Single hospital biomedical department CMMS

---

## 1. Overview

A cloud-hosted electronic maintenance management system for a biomedical department (5-20 technicians, 2K-10K devices). Full CMMS suite: corrective maintenance, preventive maintenance scheduling, asset management, and parts inventory. Accessible from desktop, tablet, and mobile.

Inspiration: UpKeep (work orders, PM, inventory, mobile-ready).

---

## 2. Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 15 (App Router), React Server + Client Components |
| UI | shadcn/ui + TailwindCSS (responsive sidebar-to-bottom-nav) |
| Auth | Supabase Auth (email/password + magic link) |
| Database | Supabase managed PostgreSQL, Supabase JS client (no ORM) |
| Validation | Zod schemas on server actions |
| Storage | Supabase Storage (equipment photos, work order attachments) |
| Hosting | Vercel (frontend), Supabase cloud (backend) |
| Migrations | Supabase CLI |

No external integrations. Standalone system.

---

## 3. Roles & Permissions

| Role | Permissions |
|------|------------|
| Admin | Full CRUD on all resources, manage users, settings |
| Technician | Create/update own work orders, view all equipment, manage parts, complete PMs |
| Viewer | Read-only access across all modules |

Enforced via Supabase Row Level Security (RLS) policies.

---

## 4. Core Entities

### 4.1 Equipment (asset registry)

Field | Type | Notes
------|------|------
id | uuid | Primary key
tag_number | text | Unique, human-readable identifier
serial_number | text | Manufacturer serial
name | text | Equipment name
model | text | Model number
manufacturer | text | Manufacturer name
department | text | Owning department
location | text | Physical location (room/floor)
status | enum | active / inactive / retired / under_repair
category | text | Classification (ventilator, pump, monitor, etc.)
install_date | date | 
warranty_expiry | date | 
photo_url | text | Supabase Storage path
notes | text | 
created_at | timestamptz | 
updated_at | timestamptz | 

### 4.2 Work Orders

Field | Type | Notes
------|------|------
id | uuid | PK
equipment_id | uuid | FK → equipment
type | enum | corrective / preventive
priority | enum | low / medium / high / critical
status | enum | open / in_progress / on_hold / completed / cancelled
description | text | Problem description
assigned_to | uuid | FK → users (technician)
created_by | uuid | FK → users
created_at | timestamptz | 
started_at | timestamptz | 
completed_at | timestamptz | 
resolution_notes | text | 
downtime_minutes | integer | Calculated on completion

### 4.3 PM Schedules

Field | Type | Notes
------|------|------
id | uuid | PK
equipment_id | uuid | FK → equipment
frequency_days | integer | e.g. 90 for quarterly
description | text | PM procedure description
checklist | jsonb | Array of checklist items with done/not-done
last_completed | timestamptz | 
next_due | timestamptz | Computed: last_completed + frequency_days
assigned_to | uuid | FK → users
active | boolean | 

### 4.4 Parts Inventory

Field | Type | Notes
------|------|------
id | uuid | PK
name | text | Part name
part_number | text | 
quantity_on_hand | integer | 
min_threshold | integer | Trigger low-stock alert when reached
unit_cost | decimal | 
supplier | text | 
location | text | Bin/shelf location
created_at | timestamptz | 
updated_at | timestamptz | 

### 4.5 Parts Usage (junction)

Field | Type | Notes
------|------|------
id | uuid | PK
work_order_id | uuid | FK → work_orders
part_id | uuid | FK → parts
quantity_used | integer | 
used_by | uuid | FK → users
used_at | timestamptz | 

Triggers: inserting a row decrements parts.quantity_on_hand. Deleting restores it.

### 4.6 Users

Supabase auth.users handles identity. A public `profiles` table extends it:

Field | Type | Notes
------|------|------
id | uuid | PK, references auth.users
full_name | text | 
role | enum | admin / technician / viewer
department | text | 
phone | text | 
created_at | timestamptz | 

---

## 5. UI Structure & Navigation

### 5.1 Desktop (sidebar layout)

- Sidebar with navigation links: Dashboard, Equipment, Work Orders, PM Schedule, Parts, Reports, Settings
- Full-width content area
- App header with user avatar, notifications, and breadcrumb

### 5.2 Mobile/Tablet (bottom navigation)

- Bottom nav bar: Home, WOs, Equipment, PMs, Parts
- Hamburger menu access to Reports, Settings, profile
- Responsive tables → stacked card layouts on small screens

### 5.3 Pages

| Route | Purpose |
|-------|---------|
| `/dashboard` | Stats cards (open WOs, overdue PMs, low stock), recent activity feed, equipment status breakdown |
| `/equipment` | Searchable/filterable table, detail page with maintenance history, PM schedule, photo |
| `/equipment/new` | Create new equipment (modal on mobile) |
| `/equipment/[id]` | Equipment detail: info tab, history tab (past WOs), PM tab |
| `/work-orders` | List with status/priority/type filters, bulk actions |
| `/work-orders/new` | Create form: equipment selector, description, priority, parts consumption |
| `/work-orders/[id]` | WO detail: status updates, resolution notes, parts used, timestamps |
| `/pm-schedules` | List view + calendar view toggle, overdue highlights |
| `/pm-schedules/[id]` | PM detail with checklist, history of completed instances |
| `/parts` | Inventory table, low-stock badges, quick restock |
| `/reports` | Compliance report, equipment downtime, technician productivity charts |
| `/settings` | User management, departments/locations CRUD, notification preferences |

---

## 6. Key Flows

### 6.1 Corrective Maintenance Flow
1. User reports broken equipment → admin/tech creates WO
2. WO assigned to technician → status: open
3. Technician starts work → WO status: in_progress, started_at set, equipment status → under_repair
4. Technician logs parts used (decrements inventory)
5. Technician completes work → WO status: completed, resolution_notes, completed_at, downtime calculated, equipment status → active

### 6.2 Preventive Maintenance Flow
1. PM schedule defined per equipment (frequency + checklist)
2. System calculates next_due date
3. Dashboard highlights overdue PMs (red), due-this-week (yellow)
4. Technician clicks "Start PM" on an overdue/due schedule → system creates a work_order (type: preventive) linked to the PM schedule
5. Technician completes checklist items within the work order
6. On WO completion: pm_schedule.last_completed updated to now, next_due recalculated (last_completed + frequency_days)

### 6.3 Parts Replenishment Flow
1. Work order consumes parts → quantity_on_hand decremented
2. When quantity_on_hand <= min_threshold: low-stock alert on dashboard
3. Dashboard badge shows count of parts below threshold
4. Admin restocks → clicks "Restock" on parts row → enters quantity added

---

## 7. Data Integrity & Business Rules

- Equipment tag_number must be unique
- Decommissioned equipment cannot have new WOs created
- Completed WOs are immutable
- Parts quantity_on_hand cannot go negative (checked server-side)
- PM next_due is always last_completed + frequency_days
- When a PM schedule is marked inactive, no new WOs are auto-generated from it
- Deleted equipment retains historical WOs (soft-deletes or cascading consideration — prefer archive/retired status)

---

## 8. Error Handling

- Zod validation on all server actions → toast errors on client
- Supabase error codes mapped to user-friendly messages
- Network failures: retry with exponential backoff, offline indicator
- 404/403 pages with redirect links

---

## 9. Testing Strategy

| Layer | Approach |
|-------|----------|
| Database | Supabase migrations + seed data for test scenarios |
| Validation | Unit tests for Zod schemas |
| Server Actions | Integration tests calling actions directly |
| UI Components | React Testing Library (shadcn/ui components) |
| E2E | Playwright for critical flows: create WO, complete PM, parts consumption |
| Mobile | Playwright viewport testing at 375px and 768px widths |

---

## 10. Out of Scope

- Barcode/RFID scanning
- Mobile push notifications (use in-app toast alerts as MVP)
- Multi-tenancy / multi-facility
- HL7 or ERP integration
- Native mobile app (PWA via Next.js is sufficient)
- Offline-first / local caching
- Advanced reporting with export (PDF/Excel) — basic dashboard only
- Calibration tracking
