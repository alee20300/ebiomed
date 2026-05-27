# EMMS Compliance Roadmap

**Document Version:** 1.0.0  
**Date:** 2026-05-27  
**Based On:** PRD v1.0.0 + Gap Analysis v1.0.0  
**Estimated Total Effort:** 11–17 weeks

---

## Phase 0: Critical Bug Fixes & Foundation Hardening

**Estimated Effort:** 1–2 days  
**Priority:** Immediate  
**Dependencies:** None

### Tasks

1. **Fix `wo_comments` FK bug** — Change `author_id` reference from `public.profiles` to `ebiomed.profiles(id)` in migration `0004_wo_comments.sql` (create a fixup migration).

2. **Fix `ebiomed` schema API exposure** — Add explicit `GRANT USAGE ON SCHEMA ebiomed TO anon, authenticated, service_role` and per-table `GRANT` statements in a new migration. Add `ebiomed` to `config.toml` `api.schemas`.

3. **Fix trigger function schema** — Move `decrement_part_quantity` and `restore_part_quantity` functions under `ebiomed` schema (qualify with `CREATE OR REPLACE FUNCTION ebiomed.`).

4. **Add `updated_at` triggers** — Create a reusable `update_updated_at_column()` trigger function and apply it to `equipment`, `pm_schedules`, `work_orders`, `profiles`, `departments`.

5. **Add `updated_at` columns** — Add missing `updated_at` column to `work_orders`, `wo_comments`, `profiles`, `departments`, `viewer_departments`, `checklist_templates`, `checklist_submissions`.

6. **Harden public RLS** — Remove `USING (true)` from equipment and checklist public policies. Limit public read to `tag_number`, `name`, `department`, `location` only (not full row).

7. **Add soft-delete support** — Add `deleted_at` timestamp column to `equipment`, `work_orders`, `pm_schedules`, `parts`. Add `WHERE deleted_at IS NULL` filter to all RLS `SELECT` policies. Replace destructive page actions with soft-deletes.

### Success Criteria
- All FK constraints resolve without errors
- All tables API-accessible with proper GRANTs
- All tables have auto-managed `updated_at`
- No destructive deletes; all records preserved
- Production deployable without known bugs

---

## Phase 1: Immutable Audit Trail (FDA 21 CFR Part 11)

**Estimated Effort:** 2–3 weeks  
**Priority:** Critical (PRD MVP)  
**Dependencies:** Phase 0

### Tasks

1. **Create `audit_log` table**
   ```
   audit_log:
     id: uuid PK
     table_name: text NOT NULL
     record_id: uuid NOT NULL
     action: enum ('insert', 'update', 'delete')
     field_name: text
     old_value: text
     new_value: text
     changed_by: uuid FK → profiles
     changed_at: timestamptz DEFAULT now()
     reason: text NOT NULL  -- mandatory per 21 CFR Part 11
   ```

2. **Create `record_audit_change()` database function** — PL/pgSQL trigger that captures OLD and NEW row values on INSERT/UPDATE/DELETE operations across all audited tables.

3. **Apply audit triggers** to: `equipment`, `work_orders`, `pm_schedules`, `parts`, `parts_usage`, `wo_comments`, `checklist_templates`, `checklist_submissions`, `profiles`, `departments`.

4. **Build "Reason for Change" UI** — Add a required text input on every edit modal/dialog. Server actions accept `reason` parameter. Client forms prompt: "Reason for change (required for compliance)."

5. **Update all server actions** — Every mutation action (`createEquipment`, `updateEquipment`, `updateWorkOrderStatus`, `startPMTask`, `completePMTask`, `consumeParts`, `restockPart`, `saveChecklistTemplate`, `addDepartment`, `saveViewerDepartments`, etc.) must accept and pass a `reason` parameter. Zod schemas updated to include `reason: z.string().min(5)`.

6. **Build Audit Log Viewer page** — New route `(app)/audit-log/page.tsx`. Filterable by table, record, user, date range. Read-only for all roles. Each entry shows: timestamp, user, action, field changed, old → new value, reason.

7. **Export audit trail** — Add CSV/JSON export button on audit log viewer. Export format must include all audit_log columns for auditor submission.

### Success Criteria
- Every insert/update/delete on core tables generates an audit_log row with mandatory reason
- Audit log viewer shows complete chronological history for any record
- Audit trail exportable for external auditor review
- All server actions accept and pass `reason` parameter

---

## Phase 2: Digital Signatures & Authentication (FDA 21 CFR Part 11)

**Estimated Effort:** 1–2 weeks  
**Priority:** Critical (PRD MVP)  
**Dependencies:** Phase 1

### Tasks

1. **Create `signatures` table**
   ```
   signatures:
     id: uuid PK
     signer_id: uuid FK → profiles NOT NULL
     record_type: text NOT NULL  -- e.g., 'work_order', 'calibration'
     record_id: uuid NOT NULL
     meaning: enum NOT NULL  -- 'Verified', 'Calibrated', 'Approved', 'Reviewed'
     signed_at: timestamptz DEFAULT now()
     signature_hash: text  -- cryptographic hash of record state at signing
   ```

2. **Build re-authentication flow** — Create `ReAuthDialog` component. Before critical actions (complete WO, approve calibration, generate certificate), prompt for password re-entry or MFA code. Validate against Supabase Auth `signInWithPassword` with the current user's email. On failure, cancel the action.

3. **Define signature meanings** — Implement `signature_meaning` enum: `Verified`, `Calibrated`, `Approved`, `Reviewed`. Map each meaning to specific actions in the workflow.

4. **Update critical server actions** — `updateWorkOrderStatus` (completed/cancelled), `completePMTask`, any future calibration completion action must:
   - Accept re-auth token from client
   - Create a `signatures` record with the appropriate meaning
   - Embed the signature_hash (SHA-256 hash of the record's current state)

5. **Build Signature Block component** — Renders on detail pages and printable output: "Electronically signed by [Full Name] on [Date/Time] — [Meaning]"

6. **Manifestation on printed output** — All printable views (work order detail, certificate, audit report) include signature blocks with printed name, date/time, and explicit meaning.

### Success Criteria
- Closing a work order requires password re-entry
- Each critical action produces a signature record with defined meaning
- Signature blocks visible on detail pages and printable output
- Schema allows for future MFA integration (TOTP, WebAuthn)

---

## Phase 3: Calibration & Traceability Engine (ISO 15189/17025)

**Estimated Effort:** 2–3 weeks  
**Priority:** Critical (PRD MVP)  
**Dependencies:** Phase 2

### Tasks

1. **Create `reference_standards` table**
   ```
   reference_standards:
     id: uuid PK
     serial_number: text UNIQUE NOT NULL
     name: text NOT NULL
     manufacturer: text
     model: text
     certificate_number: text
     certificate_expiry: date NOT NULL
     calibration_interval_days: integer NOT NULL
     location: text
     notes: text
     status: enum ('active', 'expired', 'retired')
     created_at, updated_at
   ```

2. **Create `calibration_readings` table**
   ```
   calibration_readings:
     id: uuid PK
     equipment_id: uuid FK → equipment NOT NULL
     reference_standard_id: uuid FK → reference_standards NOT NULL
     parameter: text NOT NULL  -- e.g., 'temperature', 'pressure', 'flow_rate'
     measured_value: numeric NOT NULL
     expected_value: numeric NOT NULL
     tolerance_min: numeric NOT NULL
     tolerance_max: numeric NOT NULL
     unit: text  -- e.g., '°C', 'mmHg', 'mL/min'
     passed: boolean  -- computed: measured_value between tolerance_min and tolerance_max
     notes: text
     work_order_id: uuid FK → work_orders  -- the calibration WO
     recorded_at: timestamptz DEFAULT now()
     recorded_by: uuid FK → profiles NOT NULL
   ```

3. **Create `environmental_readings` table**
   ```
   environmental_readings:
     id: uuid PK
     equipment_id: uuid FK → equipment NOT NULL
     temperature_celsius: numeric
     humidity_percent: numeric
     recorded_at: timestamptz DEFAULT now()
     recorded_by: uuid FK → profiles NOT NULL
   ```

4. **Build Reference Standards management** — CRUD pages for reference standards. List view with expiry highlighting (green: active, red: expired). Auto-status: expire → `status = 'expired'` on certificate_expiry pass.

5. **Build calibration profile on equipment** — Extend `equipment` with calibration-related fields:
   ```
   calibration_interval_days: integer
   calibration_parameters: jsonb  -- array of {parameter, unit, expected_value, tolerance_min, tolerance_max}
   last_calibrated: timestamptz
   next_calibration_due: timestamptz
   ```

6. **Build tolerance engine** — Server-side function `evaluateCalibrationReading(measured, expected, tolerance_min, tolerance_max) → { passed: boolean, deviation: number }`. UI shows real-time pass/fail with deviation percentage as user types.

7. **Build "Out-of-Tolerance" workflow** — When a reading fails tolerance:
   - Auto-flag the reading as `passed = false`
   - Prevent closing the calibration without corrective comments
   - Set equipment `status` to a new value: `out_of_tolerance`
   - Trigger notification (dashboard alert)

8. **Build calibration execution page** — New workflow route `(app)/calibration/[id]/page.tsx`:
   - Step 1: Scan equipment QR → confirm identity → log environmental conditions
   - Step 2: Select/scan reference standard → auto-validate its certificate is not expired
   - Step 3: Enter calibration readings per parameter → tolerance engine live evaluation
   - Step 4: Digital signature → generate calibration record

9. **Reference standard cross-check** — On calibration execution, validate in the server action that the selected reference standard's `status !== 'expired'` and `certificate_expiry > today`. Reject calibration if expired.

### Success Criteria
- Reference standards trackable with certificate expiry monitoring
- Calibration readings evaluated against tolerances in real-time
- Out-of-tolerance values auto-flag equipment
- Environmental conditions loggable alongside calibrations
- Expired reference standards block calibration execution

---

## Phase 4: Certificate Generation & Asset Compliance

**Estimated Effort:** 1–2 weeks  
**Priority:** Critical (PRD MVP)  
**Dependencies:** Phase 3

### Tasks

1. **Create `certificates` table**
   ```
   certificates:
     id: uuid PK
     equipment_id: uuid FK → equipment NOT NULL
     certificate_number: text UNIQUE  -- auto-generated: CERT-YYYY-NNNN
     calibration_work_order_id: uuid FK → work_orders
     audit_trail_hash: text NOT NULL  -- SHA-256 of all relevant audit_log entries
     pdf_url: text  -- Supabase Storage path
     issued_by: uuid FK → profiles NOT NULL
     issued_at: timestamptz DEFAULT now()
     valid_until: timestamptz NOT NULL
     status: enum ('valid', 'expired', 'revoked')
     signature_hash: text  -- FK → signatures
   ```

2. **Install PDF generation library** — Evaluate `@react-pdf/renderer` or `pdfmake` for server-side PDF generation. Choose the one that produces structured PDFs suitable for certificate output.

3. **Build Certificate Template** — Server-rendered certificate layout:
   - Header: "Certificate of Calibration & Compliance"
   - Equipment details block (tag_number, name, model, serial_number, department)
   - Calibration readings table (parameter, measured, expected, tolerance, pass/fail)
   - Reference standard used (serial_number, certificate_number, expiry)
   - Environmental conditions record
   - Audit trail hash (SHA-256 fingerprint of entire transaction history)
   - Signature blocks (signer name, date, meaning)
   - Certificate number, issue date, valid until date
   - Watermark/security features

4. **Implement cryptographic hashing** — Before generating PDF:
   - Collect all `audit_log` entries for the calibration work order and readings
   - SHA-256 hash the concatenated audit trail
   - Store hash in `certificates.audit_trail_hash`
   - Embed hash visibly in the PDF
   - Store hash in `signatures.signature_hash` for the issuing signature event

5. **Automate certificate generation** — On completing a calibration work order (Phase 3, workflow step 4), the system auto-generates the certificate, stores PDF in Supabase Storage (`certificates/` bucket), and updates the certificate record.

6. **Add "Certified & In Service" status** — Add `certified` to `equipment_status` enum. Update equipment to `certified` on certificate issuance. Auto-revert when certificate expires.

7. **Build certificate viewer** — On equipment detail page, add "Certificates" tab showing all issued certificates with validity status. View/Download PDF buttons.

8. **Certificate expiry monitoring** — Dashboard alert for certificates expiring within 30 days. PM schedules auto-linked to calibration intervals.

### Success Criteria
- Calibration completion auto-generates a secure, hashed PDF certificate
- Certificate hash verifiable against audit trail
- Equipment status auto-updates to "Certified" on issuance
- Expiring certificates surface on dashboard

---

## Phase 5: Asset Registry Maturation

**Estimated Effort:** 1 week  
**Priority:** Medium  
**Dependencies:** Phase 0

### Tasks

1. **Add parent-child asset hierarchy** — Add `parent_id` column to `equipment` (self-referencing FK, nullable). Child assets inherit `department` and `location` from parent (computed, not duplicated) but maintain independent calibration schedules.

2. **Build parent-child UI** — On equipment detail page, show "Child Assets" list and "Parent Asset" link. Equipment form gains "Parent Asset" selector.

3. **Add GMDN/UDI fields** — Add to `equipment`:
   ```
   gmdn_code: text
   gmdn_term: text
   udi_di: text  -- Device Identifier
   udi_pi: text  -- Production Identifier
   ```

4. **Build asset tree view** — Optional: hierarchical asset list page showing parent → children relationships.

### Success Criteria
- Equipment can have parent-child relationships with location inheritance
- GMDN/UDI fields available on equipment form and detail
- Child assets maintain independent calibration schedules

---

## Phase 6: Integration & Advanced Features (PRD Phase 2)

**Estimated Effort:** 3–4 weeks  
**Priority:** Low  
**Dependencies:** Phase 1 (audit trail), Phase 3 (calibration)

### Tasks

1. **Build secure REST API** — Create `src/app/api/v1/` route group:
   - `GET /api/v1/equipment` — List equipment with status
   - `GET /api/v1/equipment/:id` — Equipment detail with calibration status
   - `GET /api/v1/equipment/:id/certificates` — Current certificate
   - `GET /api/v1/work-orders` — Filter by status, equipment, date
   - `POST /api/v1/fault-reports` — Programmatic fault reporting
   - All endpoints require API key auth (add `api_keys` table)

2. **Implement HL7/FHIR endpoint** — Evaluate scope:
   - Minimal: `GET /api/v1/fhir/Device/:id` — FHIR Device resource for equipment
   - Full: FHIR Device, DeviceMetric, Observation resources
   - Accept HL7 v2 ORU messages for lab instrument status

3. **Implement usage-based PM triggers** — Add to `equipment`:
   ```
   run_hours: numeric  -- current counter
   cycle_count: integer  -- current counter
   pm_trigger_type: enum ('calendar', 'run_hours', 'cycles', 'calendar_or_usage', 'calendar_and_usage')
   pm_trigger_value: numeric  -- threshold: hours or cycles
   ```
   Add `POST /api/v1/equipment/:id/update-counter` endpoint for IoT integration. Cron job evaluates equipment counters against `pm_trigger_value` and auto-generates PM work orders.

4. **IoT data ingestion endpoint** — `POST /api/v1/telemetry` — Accept run hours, cycle counts, temperature readings from connected devices.

5. **Build REST API documentation** — OpenAPI/Swagger spec at `/api/docs`.

### Success Criteria
- REST API with API key auth enables LIMS/HIS integration
- HL7/FHIR Device resource endpoint available
- Run-hour and cycle-count based PM triggers auto-generate work orders
- IoT telemetry endpoint accepts counter updates

---

## Dependency Graph

```
Phase 0 (Bug Fixes)
  ├── Phase 1 (Audit Trail)
  │     ├── Phase 2 (Digital Signatures)
  │     │     ├── Phase 3 (Calibration Engine)
  │     │     │     ├── Phase 4 (Certificates)
  │     │     │     └── Phase 6 (Integration)
  │     │     └── Phase 6 (REST API)
  │     └── Phase 6 (FHIR, triggers)
  └── Phase 5 (Asset Hierarchy)
```

Phases 0, 1, and 2 are strictly sequential (each builds on the previous). Phases 3 and 5 can begin in parallel once Phase 2 is done. Phase 4 depends on Phase 3. Phase 6 depends on Phases 1 and 3.

---

## Effort Summary

| Phase | Theme | Weeks | PRD Coverage |
|---|---|---|---|
| 0 | Critical Bug Fixes & Foundation | 0.3 | — |
| 1 | Immutable Audit Trail | 2–3 | FDA 21 CFR Part 11 |
| 2 | Digital Signatures | 1–2 | FDA 21 CFR Part 11 |
| 3 | Calibration & Traceability | 2–3 | ISO 15189/17025 + FR-2.3 |
| 4 | Certificate Generation | 1–2 | FR-2.2 + Certification Workflow |
| 5 | Asset Registry Maturation | 1 | FR-1.2, FR-1.3 |
| 6 | Integration & Advanced (Phase 2) | 3–4 | NFR-2.1 + FR-2.1 (usage triggers) |
| **Total** | | **10–15** | Full PRD coverage |
