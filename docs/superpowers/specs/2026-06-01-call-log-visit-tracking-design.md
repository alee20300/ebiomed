# Call Log & Engineer Visit Tracking — Design Spec

**Date:** 2026-06-01
**Status:** Draft
**Dependencies:** Existing EMMS (ebiomed schema), public fault report, complaints, feature toggle system (app_settings)

---

## 1. Overview

Three changes behind a single feature toggle (`call_log_workflow_enabled`):

1. **Call log on fault report** — When hospital staff report a fault via the public `/report` page, they record whether they called the biomedical department and, if so, which technician answered.
2. **Engineer site visit logging** — When the biomed engineer arrives at the equipment, they scan the same QR/barcode. The system detects an open complaint and lets the engineer log their visit with an automatic timestamp.
3. **Feature toggle** — Toggleable from Settings → General. When OFF, zero behavior change.

---

## 2. Data Model

### 2.1 Complaints — New Columns

Add to `ebiomed.complaints`:

| Column | Type | Notes |
|--------|------|-------|
| called_department | boolean | Did the reporter call biomed? |
| answered_by | text, nullable | Free-text name of technician who answered |
| call_status | text, nullable | `'answered'` or `'unanswered'` |

All three columns are nullable. When the toggle is OFF, they remain null. No enum type needed — validated at the application level via Zod.

### 2.2 New Table: `ebiomed.visit_logs`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | auto-generated |
| complaint_id | uuid FK NOT NULL | references ebiomed.complaints(id) |
| visited_by | uuid FK NOT NULL | references ebiomed.profiles(id) — the engineer who scanned |
| visited_at | timestamptz NOT NULL | auto-set to now() on insert |
| created_at | timestamptz NOT NULL | DEFAULT now() |

A complaint can have multiple visit logs (multiple visits by different engineers).

### 2.3 App Settings Seed

```sql
INSERT INTO ebiomed.app_settings (key, value)
VALUES ('call_log_workflow_enabled', 'false')
ON CONFLICT (key) DO NOTHING;
```

---

## 3. Feature Toggle

**Key:** `call_log_workflow_enabled` (boolean, default `false`)

**UI:** New toggle card in Settings → General tab, same Switch component pattern as the existing Expense Tracking toggle. Label: "Call Log & Visit Tracking". Admin only.

**Guard locations:**
- Fault report form: conditionally render call-log fields
- Fault report server action: conditionally validate call-log fields
- QR scan page (`/report`): conditionally show visit-logging option to logged-in engineers
- Complaint detail page: conditionally render visit history section

When OFF, no columns are populated, no visit_logs are created, no UI changes appear.

---

## 4. Fault Report Form Changes

### 4.1 New Fields (conditional on toggle)

Added to the public `/report` page, between the description textarea and the submit button:

1. **"Did you call the biomedical department?"** — Yes/No radio buttons. Required when toggle is ON.
2. **"Technician who answered?"** — Text input. Only shown when "Yes" is selected. Free text (nurse doesn't know profile UUIDs). Required when visible.

Choosing "No" sets `call_status = 'unanswered'` and `answered_by = null`.

Choosing "Yes" with a name sets `call_status = 'answered'` and `answered_by` to the entered name.

### 4.2 Zod Schema (conditional)

When toggle is ON, the schema extends `FaultReportFormData`:

```ts
called_department: z.boolean({ required_error: "Please indicate whether you called the department" }),
answered_by: z.string().optional(),
call_status: z.enum(["answered", "unanswered"]).optional(),
```

The server action reads the toggle, applies conditional validation, and stores the fields on the complaint row.

### 4.3 UI

Two compact inline fields, matching the existing form style (same spacing, same input components). No layout changes elsewhere on the page.

---

## 5. Engineer Visit Flow

### 5.1 QR/Barcode Scan Detection

The `/report` page already handles scanning equipment barcodes/QR codes. When toggle is ON:

- If a logged-in admin or technician scans equipment that has **open complaints** (status `pending_review` or `approved`), show a banner above the normal flow: *"This equipment has an open fault report from [date]."* with a "Log Site Visit" button.
- If there are multiple open complaints, list each with its own button.

When toggle is OFF or the user is not logged in, the page behaves as today.

### 5.2 Logging the Visit

Clicking "Log Site Visit" calls a server action `logEngineerVisit(complaint_id)`:

1. Inserts row into `visit_logs`: `complaint_id`, `visited_by` = current user UUID, `visited_at` = now()
2. Logs an audit event: "Engineer visit logged for complaint [id]"
3. Returns success → client shows toast: "Visit logged at [HH:MM]"
4. Button changes to "Visit logged ✓" (disabled)

### 5.3 Visit History on Complaint Detail

On `/complaints/[id]`, when toggle is ON and visits exist, show a "Site Visits" section below the complaint info:

| Engineer | Visited At |
|----------|-----------|
| John Smith | 2026-06-01 14:30 |
| Jane Doe | 2026-06-01 16:00 |

Pulled from `visit_logs` joined with `profiles`.

---

## 6. Server Actions

### 6.1 `submitFaultReport` (modify existing)

Reads `call_log_workflow_enabled`. If ON, conditionally validates `called_department`, `answered_by`, `call_status`. Stores them on the complaint INSERT.

### 6.2 `logEngineerVisit` (new)

```ts
export async function logEngineerVisit(complaintId: string): Promise<void>
```

Validates:
- User is admin or technician
- Complaint exists and belongs to equipment (checked for access)
- Complaint is not already `rejected`

Inserts into `visit_logs` and logs audit.

### 6.3 `getComplaintVisits` (new)

```ts
export async function getComplaintVisits(complaintId: string): Promise<VisitLog[]>
```

Returns all visits for a complaint, joined with profile names. Used by complaint detail page.

---

## 7. Files to Create / Modify

| File | Action |
|------|--------|
| `supabase/migrations/0015_call_log_visit_tracking.sql` | Create |
| `src/lib/types/index.ts` | Add `VisitLog` type, extend `Complaint` type |
| `src/lib/schemas/fault-report.ts` | Add conditional fields |
| `src/lib/actions/fault-report.ts` | Handle new fields conditionally |
| `src/lib/actions/visit-logs.ts` | Create (new server actions) |
| `src/lib/schemas/visit-log.ts` | Create (Zod schema) |
| `src/components/report/fault-form.tsx` | Add conditional UI fields |
| `src/app/report/page.tsx` | Add visit-logging banner for engineers |
| `src/components/settings/call-log-toggle.tsx` | Create (toggle card) |
| `src/app/(app)/settings/page.tsx` | Add toggle to General tab |
| `src/app/(app)/complaints/[id]/page.tsx` | Add visit history section |
| `src/components/complaints/complaint-detail-card.tsx` | Add visit history sub-component (or inline) |

---

## 8. Testing

- **Unit**: Zod schema conditional validation (toggle ON vs OFF)
- **Unit**: `logEngineerVisit` guards (role, complaint state)
- **Integration**: Fault report submission with/without call log fields
- **Integration**: Engineer scans QR, sees visit option, logs visit
- **Integration**: Toggle OFF → no new fields, no visit banner, no visit section
- **E2E**: Full flow: report fault with call log → engineer scans QR → logs visit → admin sees visits on complaint detail
