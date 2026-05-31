# Complaints, Job Cards & Expense Tracking — Design Spec

**Date:** 2026-05-31
**Status:** Approved
**Dependencies:** Existing EMMS (ebiomed schema), public fault report, work orders, audit log, signatures, settings page

---

## 1. Overview

Four connected features that mature the work order system:

1. **Complaints** — Fault reports no longer auto-create work orders. They create a complaint that requires manual review and approval before a work order is created.
2. **Job Cards** — Each work order can have multiple job cards (parallel). Technicians start, log time/parts/work done, and close job cards independently of the work order lifecycle.
3. **Expense Tracking** — Optional (global toggle), job-card-scoped. Tracks food, ticket, and accommodation expenses with slip uploads. For back-office use only — not exposed on service reports.
4. **Work Order Completion Report** — Printable formal service report aggregating all job cards, parts, time, and signatures.

---

## 2. Data Model

### 2.1 New Tables

**`ebiomed.complaints`**

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | auto-generated |
| equipment_id | uuid FK NOT NULL | references ebiomed.equipment(id) |
| description | text NOT NULL | fault description from reporter |
| photo_url | text | uploaded fault photo |
| reported_by_name | text | from public form |
| reported_by_department | text | from public form |
| status | complaint_status | pending_review, approved, rejected |
| reviewer_id | uuid FK | references ebiomed.profiles(id), who reviewed |
| review_notes | text | required on rejection |
| created_at | timestamptz NOT NULL | default now() |
| updated_at | timestamptz NOT NULL | auto-triggered |
| deleted_at | timestamptz | soft delete |

Enum: `CREATE TYPE ebiomed.complaint_status AS ENUM ('pending_review', 'approved', 'rejected')`

**`ebiomed.job_cards`**

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | auto-generated |
| work_order_id | uuid FK NOT NULL | references ebiomed.work_orders(id) |
| technician_id | uuid FK NOT NULL | references ebiomed.profiles(id) |
| status | job_card_status | in_progress, completed |
| started_at | timestamptz NOT NULL | set on creation |
| completed_at | timestamptz | set on completion |
| summary | text | required on completion — what was done |
| unresolved_issues | text | optional — what remains |
| created_at | timestamptz NOT NULL | default now() |
| updated_at | timestamptz NOT NULL | auto-triggered |

Enum: `CREATE TYPE ebiomed.job_card_status AS ENUM ('in_progress', 'completed')`

**`ebiomed.job_card_entries`** (time log)

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | auto-generated |
| job_card_id | uuid FK NOT NULL | references ebiomed.job_cards(id) |
| description | text NOT NULL | what was done during this entry |
| started_at | timestamptz NOT NULL | |
| ended_at | timestamptz NOT NULL | |
| duration_minutes | integer NOT NULL | calculated: (ended_at - started_at) |

**`ebiomed.job_card_parts`** (parts consumed per job card)

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | auto-generated |
| job_card_id | uuid FK NOT NULL | references ebiomed.job_cards(id) |
| part_id | uuid FK NOT NULL | references ebiomed.parts(id) |
| quantity_used | integer NOT NULL | deducts from inventory on save |

**`ebiomed.job_card_expenses`** (optional — only if expense tracking enabled)

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | auto-generated |
| job_card_id | uuid FK NOT NULL | references ebiomed.job_cards(id) |
| category | expense_category | food, ticket, accommodation |
| amount | decimal(10,2) NOT NULL | |
| description | text NOT NULL | e.g. "Round trip taxi" |
| slip_url | text | Supabase Storage signed URL |

Enum: `CREATE TYPE ebiomed.expense_category AS ENUM ('food', 'ticket', 'accommodation')`

**`ebiomed.app_settings`** (general-purpose feature flags)

| Column | Type | Notes |
|--------|------|-------|
| key | text PK | setting identifier |
| value | jsonb NOT NULL | typed value |
| updated_by | uuid FK | references ebiomed.profiles(id) |
| updated_at | timestamptz NOT NULL | default now() |

### 2.2 Changes to Existing Tables

**`ebiomed.work_orders`** — add one column:

| Column | Type | Notes |
|--------|------|-------|
| complaint_id | uuid FK | nullable, references ebiomed.complaints(id) |

Existing columns `reported_by_name`, `reported_by_department`, `issue_photo_url` are **retained** for backward compatibility with existing work orders. New fault reports go through complaints — these columns will be NULL on new WOs.

### 2.3 Relationships

```
fault_report_form ──→ complaints ──→ work_orders (via complaint_id FK, nullable)
                                     └──→ job_cards (1:N)
                                           ├──→ job_card_entries (0:N, time log)
                                           ├──→ job_card_parts (0:N, parts used)
                                           └──→ job_card_expenses (0:N, if toggle ON)
```

---

## 3. Complaint Flow

### 3.1 Status Machine

```
pending_review ──→ approved   (creates WO, terminal)
pending_review ──→ rejected   (closed with reason, terminal)
```

### 3.2 Submitting a Complaint (changes to submitFaultReport)

Current behavior: `submitFaultReport` creates a `work_order` directly.

New behavior:
1. Validate form + photo (same as current)
2. Upload photo to `fault-photos` bucket (same path pattern, but keyed to complaint ID)
3. Create `complaints` row with status `pending_review`
4. **Do NOT** create a work order
5. **Do NOT** change equipment status
6. Log audit entry for complaint creation
7. Redirect to `/report/success?complaint=COMPLAINT_ID`

### 3.3 Review Queue

New page: `/complaints` (authenticated, admin/technician only)

- Table listing all `pending_review` complaints
- Columns: equipment name, tag, reported by, department, date, fault description (truncated)
- Dashboard card: "N complaints pending review" (replaces or supplements existing alert)

New page: `/complaints/[id]` (authenticated, admin/technician only)

- Full complaint detail: equipment info, photo, description, reporter details
- **Approve button** — opens confirmation with optional review notes. On confirm:
  1. Set complaint status → `approved`, `reviewer_id` → current user
  2. Call `createWorkOrder()` internally with complaint data (equipment_id, description, type: corrective, priority from complaint)
  3. Set `work_order.complaint_id` FK
  4. Set equipment status → `under_repair`
  5. Log audit entries for complaint approval + WO creation
  6. Redirect to new WO detail page
- **Reject button** — opens dialog requiring `review_notes`. On confirm:
  1. Set complaint status → `rejected`, `reviewer_id` → current user
  2. Log audit entry
  3. Redirect to complaints list

### 3.4 Middleware

Add `/complaints` to the authenticated routes (already handled by the `(app)` layout group — no middleware change needed).

---

## 4. Job Card Flow

### 4.1 Status Machine

```
in_progress ──→ completed (terminal, cannot reopen)
```

### 4.2 Creating a Job Card

Button: "Start Job Card" on the work order detail page. Visible when WO status is `open` or `in_progress`.

On creation:
1. Insert `job_cards` row: `work_order_id`, `technician_id` = current user, `status` = `in_progress`, `started_at` = now()
2. Log audit entry
3. WO status is **unchanged** (starting a job card does not modify the work order)

### 4.3 Working on a Job Card

Job card detail is embedded in the WO detail page as an expandable card section. Each job card shows:

- **Header**: Job card #, technician name, status badge, started time
- **Time entries**: List of time log entries with description + duration. "Add Time Entry" button opens inline form (description, start time, end time — duration auto-calculated).
- **Parts used**: List of parts consumed. "Add Part" button opens inline form (search/select part from inventory, quantity). Deducts from stock on save.
- **Expenses section** (only visible when `expense_tracking_enabled` is true): table of expenses with category, amount, description, slip upload per line item.

Multiple job cards can be `in_progress` simultaneously on the same work order. This is allowed and intentional — different technicians may be working on different aspects.

### 4.4 Closing a Job Card

"Complete Job Card" button at the bottom of the job card section.

Form requires:
- **Summary** (text, required) — what was done during this job card
- **Unresolved issues** (text, optional) — what still needs attention

On close:
1. Set `status` → `completed`, `completed_at` → now()
2. Set `summary` and `unresolved_issues`
3. Log audit entry
4. **WO status is unchanged** — closing a job card does not complete the work order

### 4.5 Rules

- Job cards are immutable after creation — no edit, only soft-delete (audit trail)
- `completed` is terminal — cannot reopen a closed job card
- Job cards do NOT set equipment status
- Job cards do NOT affect work order status
- No pause/on_hold for job cards — keeps the model simple

---

## 5. Expense Tracking (Optional)

### 5.1 Global Toggle

Controlled by `app_settings` row: `{key: "expense_tracking_enabled", value: true|false}`.

Default: `false` (disabled).

### 5.2 Settings UI

New "General" tab on the Settings page (first tab, before Users/Departments/Checklists/Equipment):

- Toggle switch for "Expense Tracking"
- On change: calls `updateAppSetting('expense_tracking_enabled', newValue)` server action
- Admin-only (technician and viewer see the toggle as disabled/read-only)

### 5.3 Server-Side Guard

The expense save action (`addJobCardExpense`) checks the setting server-side before inserting:

```ts
const setting = await getAppSetting("expense_tracking_enabled")
if (setting.value !== true) {
  throw new Error("Expense tracking is disabled")
}
```

This prevents bypassing the toggle via direct API calls.

### 5.4 Expense Categories

Three categories (enum):
- `food` — meals during service visit
- `ticket` — transport tickets
- `accommodation` — hotel/lodging

### 5.5 Slip Uploads

- Bucket: `expense-slips` (new, private)
- Path: `{job_card_id}/{expense_id}.{ext}`
- RLS: authenticated users can upload to their own job card expenses; admin can view all
- Display: signed URLs (1-hour expiry), not public URLs
- One slip per expense line (optional — expenses without slips are valid)

### 5.6 Visibility

Expenses are **back-office only**:
- Visible on job card detail within the WO page
- Visible in a dedicated Expenses summary somewhere in the admin area (future enhancement — not in MVP scope)
- **NOT** included in the work order completion report
- **NOT** visible to viewers

---

## 6. Work Order Completion Report

### 6.1 Route

`/work-orders/[id]/report` — dedicated page, server-rendered, print-optimized.

### 6.2 Availability

- "Print Report" button appears on WO detail when `status === 'completed'`
- Hidden for all other statuses
- For `cancelled` WOs: report renders with "CANCELLED" watermark

### 6.3 Content

The report aggregates:

| Section | Source |
|---------|--------|
| Header | WO ID, dates, type, priority |
| Equipment Info | equipment name, tag, serial, department |
| Fault Description | work_orders.description |
| Service Performed | All job cards (completed only) with summary, time, parts, unresolved issues |
| Totals | Total labor (sum of all job card durations), total parts, total downtime |
| Signatures | Existing `signatures` table entries for this WO |

Expenses are **excluded** from the service report.

### 6.4 Print Implementation

- Server component with `@media print` CSS
- Hide sidebar, header, nav, buttons when printing
- A4 sizing with proper margins (2cm)
- Page breaks between job cards if needed
- Monochrome-friendly (no background colors when printed)
- "Print Report" button calls `window.print()`
- Report footer: "Generated by eBiomed CMMS · Report ID: RPT-{WO-num} · Page X of Y"

### 6.5 PDF (Future)

Browser print is the MVP. The HTML report layout is designed so that server-side PDF generation (e.g., Puppeteer) can be added later without layout changes.

---

## 7. New Server Actions

### 7.1 Complaints

| Action | File | Description |
|--------|------|-------------|
| `submitFaultReport` (modified) | `lib/actions/fault-report.ts` | Now creates complaint instead of WO |
| `approveComplaint(id, notes?)` | `lib/actions/complaints.ts` | Approve + auto-create WO |
| `rejectComplaint(id, notes)` | `lib/actions/complaints.ts` | Reject with required reason |
| `getComplaints()` | `lib/actions/complaints.ts` | List pending complaints |
| `getComplaintById(id)` | `lib/actions/complaints.ts` | Single complaint with relations |

### 7.2 Job Cards

| Action | File | Description |
|--------|------|-------------|
| `createJobCard(woId)` | `lib/actions/job-cards.ts` | Start a new job card |
| `completeJobCard(id, summary, unresolved?)` | `lib/actions/job-cards.ts` | Close with required summary |
| `getJobCards(woId)` | `lib/actions/job-cards.ts` | All job cards for a WO |
| `addJobCardEntry(jcId, data)` | `lib/actions/job-cards.ts` | Add time log entry |
| `addJobCardPart(jcId, partId, qty)` | `lib/actions/job-cards.ts` | Record part usage + deduct stock |

### 7.3 Expenses

| Action | File | Description |
|--------|------|-------------|
| `addJobCardExpense(jcId, data)` | `lib/actions/expenses.ts` | Add expense line (guarded by toggle) |
| `deleteJobCardExpense(id)` | `lib/actions/expenses.ts` | Remove expense line |

### 7.4 Settings

| Action | File | Description |
|--------|------|-------------|
| `getAppSetting(key)` | `lib/actions/settings.ts` | Read a setting value |
| `updateAppSetting(key, value)` | `lib/actions/settings.ts` | Update setting (admin only) |

---

## 8. New Zod Schemas

**`lib/schemas/complaint.ts`**
```ts
export const complaintReviewSchema = z.object({
  review_notes: z.string().min(5, "Review notes required").max(500),
})
```

**`lib/schemas/job-card.ts`**
```ts
export const jobCardCompleteSchema = z.object({
  summary: z.string().min(10, "Summary must be at least 10 characters"),
  unresolved_issues: z.string().optional(),
})

export const jobCardEntrySchema = z.object({
  description: z.string().min(1, "Description is required"),
  started_at: z.string().datetime(),
  ended_at: z.string().datetime(),
})

export const jobCardPartSchema = z.object({
  part_id: z.string().uuid("Valid part is required"),
  quantity_used: z.number().int().min(1, "Quantity must be at least 1"),
})
```

**`lib/schemas/expense.ts`**
```ts
export const expenseSchema = z.object({
  category: z.enum(["food", "ticket", "accommodation"]),
  amount: z.number().positive("Amount must be positive"),
  description: z.string().min(1, "Description is required"),
})
```

**`lib/schemas/settings.ts`**
```ts
export const appSettingSchema = z.object({
  key: z.string().min(1),
  value: z.any(),
})
```

---

## 9. UI Pages & Components

### 9.1 New Pages

| Route | Purpose | Auth |
|-------|---------|------|
| `/complaints` | Complaint review queue (list all pending) | admin, technician |
| `/complaints/[id]` | Complaint detail with approve/reject | admin, technician |
| `/work-orders/[id]/report` | Printable completion report | admin, technician |

### 9.2 Modified Pages

| Page | Changes |
|------|---------|
| WO Detail (`/work-orders/[id]`) | Add job cards section, "Start Job Card" button, "Print Report" button (when completed) |
| Dashboard | Add "Pending Complaints" stat card |
| Settings | Add "General" tab (first tab) with expense tracking toggle |
| Report Success (`/report/success`) | Update message — "Complaint submitted" instead of "Work order created" |

### 9.3 New Components

| Component | Location |
|-----------|----------|
| `ComplaintTable` | `components/complaints/complaint-table.tsx` |
| `ComplaintDetailCard` | `components/complaints/complaint-detail-card.tsx` |
| `JobCardSection` | `components/work-orders/job-card-section.tsx` |
| `JobCardDetail` | `components/work-orders/job-card-detail.tsx` |
| `TimeEntryForm` | `components/work-orders/time-entry-form.tsx` |
| `ExpenseForm` | `components/work-orders/expense-form.tsx` |
| `ExpenseToggle` | `components/settings/expense-toggle.tsx` |
| `WOCompletionReport` | `components/work-orders/wo-completion-report.tsx` |

---

## 10. TypeScript Types

Add to `lib/types/index.ts`:

```ts
export type ComplaintStatus = "pending_review" | "approved" | "rejected"
export type JobCardStatus = "in_progress" | "completed"
export type ExpenseCategory = "food" | "ticket" | "accommodation"

export interface Complaint {
  id: string
  equipment_id: string
  description: string
  photo_url: string | null
  reported_by_name: string | null
  reported_by_department: string | null
  status: ComplaintStatus
  reviewer_id: string | null
  review_notes: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
  equipment?: Equipment
  reviewer?: Profile | null
}

export interface JobCard {
  id: string
  work_order_id: string
  technician_id: string
  status: JobCardStatus
  started_at: string
  completed_at: string | null
  summary: string | null
  unresolved_issues: string | null
  created_at: string
  updated_at: string
  technician?: Profile | null
  entries?: JobCardEntry[]
  parts?: JobCardPart[]
  expenses?: JobCardExpense[]
}

export interface JobCardEntry {
  id: string
  job_card_id: string
  description: string
  started_at: string
  ended_at: string
  duration_minutes: number
}

export interface JobCardPart {
  id: string
  job_card_id: string
  part_id: string
  quantity_used: number
  part?: Part | null
}

export interface JobCardExpense {
  id: string
  job_card_id: string
  category: ExpenseCategory
  amount: number
  description: string
  slip_url: string | null
}

export interface AppSetting {
  key: string
  value: any
  updated_by: string | null
  updated_at: string
}
```

Update `WorkOrder` interface to add `complaint_id: string | null` and `complaint?: Complaint | null`.

---

## 11. Storage Buckets

| Bucket | Purpose | Access | RLS |
|--------|---------|--------|-----|
| `fault-photos` (existing) | Now stores complaint photos (path: `{complaint_id}.{ext}`) | Public read via signed URL | Upload: public, Read: authenticated |
| `expense-slips` (new) | Receipt/slip images | Private | Upload: authenticated (own job cards), Read: admin |

---

## 12. Migration Plan

1. Create enums: `complaint_status`, `job_card_status`, `expense_category`
2. Create tables: `complaints`, `job_cards`, `job_card_entries`, `job_card_parts`, `job_card_expenses`, `app_settings`
3. Add `complaint_id` FK to `work_orders` (nullable)
4. Create `expense-slips` storage bucket
5. Seed `app_settings` with `expense_tracking_enabled: false`
6. Enable RLS on all new tables
7. Modify `submitFaultReport` to create complaints instead of work orders

**Backward compatibility:** Existing work orders and fault report columns are untouched. The new flow applies only to new fault reports.

---

## 13. Out of Scope

- PDF generation (browser print only for MVP)
- Expense reports / expense analytics dashboard
- Job card templates or scheduled job cards
- SLA tracking on complaints (time-to-review)
- Email notifications for complaint review
- Reopening completed job cards
- Bulk approve/reject complaints
