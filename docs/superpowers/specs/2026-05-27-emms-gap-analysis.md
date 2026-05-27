# EMMS Gap Analysis

**Document Version:** 1.0.0  
**Date:** 2026-05-27  
**Target:** Healthcare Certificate Electronic Maintenance Management System (EMMS)  
**Analyzed Artifact:** PRD v1.0.0 vs. current codebase at commit `cb03706d`

---

## 1. Executive Summary

The current implementation is a fully functional **CMMS** (Computerized Maintenance Management System) with asset registry, corrective and preventive work orders, parts inventory, public fault reporting with QR/barcode scanning, role-based access control, and a responsive UI. However, it falls far short of the PRD's **EMMS** vision, which requires compliance-grade features: immutable audit trails, dual-factor digital signatures, calibration verification, metrological traceability, environmental logging, and cryptographically secure certificate generation.

**Overall Compliance Readiness Score: 0/10**

No PRD compliance-critical features are implemented. The system handles basic maintenance management well but would fail any FDA 21 CFR Part 11 or ISO 15189 audit.

---

## 2. Methodology

Each PRD requirement was traced to:
1. **Source code** — server actions (`src/lib/actions/`), UI components (`src/components/`), pages (`src/app/`)
2. **Database schema** — migration files (`supabase/migrations/`), RLS policies, triggers
3. **Documentation** — design specs and implementation plans (`docs/superpowers/`)
4. **Types and validation** — TypeScript interfaces (`src/lib/types/`) and Zod schemas (`src/lib/schemas/`)

Status classification:
- **Implemented** — Feature exists and matches PRD intent
- **Partially Implemented** — Core mechanic exists but lacks compliance-specific details
- **Not Implemented** — No corresponding code, schema, or plan exists

---

## 3. Detailed Gap Matrix

### 3.1 Regulatory & Compliance (PRD Section 3)

| PRD Requirement | Status | Implementation Details | Missing Pieces |
|---|---|---|---|
| **FDA 21 CFR Part 11 — Immutable Audit Trail** (append-only, old + new values, user ID, timestamp, "Reason for Change") | **Not Implemented** | No `audit_log` table. Server actions (e.g., `updateWorkOrderStatus`, `updateEquipment`) overwrite rows directly. RLS policies exist but are not audit-grade. | Dedicated audit_log table, triggers/hooks at action layer to capture all mutations, "Reason for Change" UI input on every edit, audit log viewer. |
| **FDA 21 CFR Part 11 — Dual-Factor Signatures** (re-authentication on WO closure/signing) | **Not Implemented** | `updateWorkOrderStatus` can complete/cancel a WO without any re-authentication. No MFA integration. No concept of a "signature event" in the data model. | Re-auth challenge (password/MFA) before critical actions, `signatures` table recording signer ID, timestamp, meaning, and hash. |
| **FDA 21 CFR Part 11 — Manifestation of Signatures** (printed name, date/time, explicit meaning e.g. "Verified", "Calibrated", "Approved") | **Not Implemented** | Comments (`wo_comments`) track author + text but no link to a formal signature event. No UI element displays signature meaning alongside user identity. | Signature block component, signature meaning enum, rendered signature line on any printable output. |
| **ISO 15189/17025 — Metrological Traceability** (reference standard serial numbers, validity date cross-check) | **Not Implemented** | No `reference_standards` table. No link between calibration actions and certified master instruments. No validity date validation. | Reference standards table with serial number, certificate expiry, calibration interval; cross-check on calibration entry. |
| **ISO 15189/17025 — Environmental Logging** (temperature, humidity alongside calibration values) | **Not Implemented** | No environmental data fields on any table. PM checklist items have `ok`/`not_ok` but no temperature/humidity capture. | Environmental conditions fields on `checklist_submissions`, optional environmental logging on calibration events. |

### 3.2 Core Functional Requirements (PRD Section 4)

#### 4.1 Asset Registry & Hierarchy

| PRD ID | Requirement | Status | Details |
|---|---|---|---|
| **FR-1.1** | Barcode/QR code scanning via mobile camera | **Implemented** | `BarcodeScanner` component uses html5-qrcode with camera + manual entry fallback. `QRCodeDisplay` component generates QR codes. `BarcodeDisplay` generates Code 128 barcodes. |
| **FR-1.2** | Parent-Child asset architecture (children inherit location, separate calibration schedules) | **Not Implemented** | No `parent_id` column on `equipment`. No location inheritance logic. No child-specific calibration independence. |
| **FR-1.3** | GMDN/UDI nomenclature integration | **Not Implemented** | No GMDN or UDI fields on the equipment table. No nomenclature validation. |

#### 4.2 Maintenance, Calibration & Certification Engine

| PRD ID | Requirement | Status | Details |
|---|---|---|---|
| **FR-2.1** | Dual-trigger PM: calendar-based + usage-based (run hours, cycle counts) | **Partially Implemented** | Calendar-based triggers exist via `pm_schedules.frequency_days` and `next_due` calculation. Usage-based triggers: no run-hour or cycle-count fields on equipment, no counter-based scheduling. |
| **FR-2.2** | Dynamic certificate generator (un-editable PDFs with secure metadata hashes) | **Not Implemented** | No PDF library, no certificate template, no cryptographic hashing of transaction history, no "locked" output. |
| **FR-2.3** | Strict tolerance engine (real-time comparison against master specs, auto-flag out-of-tolerance) | **Not Implemented** | Checklist items have `ok`/`not_ok` binary states only. No quantitative tolerance ranges, no real-time evaluation, no auto-flagging. |

### 3.3 Certification Workflow (PRD Section 5)

| Step | PRD Description | Status | What's Built | What's Missing |
|---|---|---|---|---|
| **Step 1** | Asset ID & Pre-Check: scan QR → confirm identity → pull calibration profile → log environmental conditions | **Partial** | QR scanning and equipment lookup via `getEquipmentByTag()`. Equipment detail page shows asset info. | Calibration profile concept, environmental logging UI and DB fields. |
| **Step 2** | Reference Standard Mapping: scan/input certified master instrument → cross-check its own certification validity | **Not Implemented** | — | Entire concept: reference standards table, validity date cross-check, expired standard rejection. |
| **Step 3** | Quantitative Metric Logging: enter calibration readings → tolerance engine evaluates → flag out-of-spec | **Not Implemented** | Checklist items can be toggled ok/not_ok. | Tolerance ranges on checklists, numerical input fields, real-time comparison, auto-flagging, corrective comment requirement. |
| **Step 4** | Dual-Factor Cryptographic Sign-Off: re-auth → embed digital identity permanently | **Not Implemented** | — | Re-auth challenge UI, signature event recording, digital identity embedding, signature meaning. |
| **Step 5** | Immutable Certificate Generation: compile data → cryptographic hash → secure PDF → update asset to "Certified & In Service" | **Not Implemented** | — | PDF generation, cryptographic hashing, lockable certificate records, "Certified" equipment status. |

### 3.4 Non-Functional Requirements (PRD Section 6)

| PRD ID | Requirement | Status | Details |
|---|---|---|---|
| **NFR-1.1** | TLS 1.3 in transit, AES-256 at rest | **Partially** | Supabase manages TLS. Encryption at rest depends on Supabase project configuration (enabled by default). No application-layer encryption. |
| **NFR-1.2** | Granular RBAC | **Partially** | Three roles (admin/technician/viewer) with RLS policies. Viewer department scoping at app layer. Gaps: no object-level permissions, role changes not audited, no separated admin vs. technician scope. |
| **NFR-2.1** | REST APIs + HL7/FHIR endpoints | **Not Implemented** | No API endpoints for external consumption. All data access is via server actions only (not RESTful). No HL7/FHIR support. |

### 3.5 Prioritization Matrix (PRD Section 6 — MVP vs Phase 2)

| Feature Block | Target Release | PRD Complexity | Current Status | Gap |
|---|---|---|---|---|
| **QR Asset Scanning & Inventory Master** | MVP | Low | **Implemented** | — |
| **Append-Only Audit Trail (21 CFR Part 11)** | MVP | High | **Not Implemented** | Full audit trail + "Reason for Change" |
| **Dual-Factor Digital Signatures** | MVP | Medium | **Not Implemented** | Re-auth flow + signature recording |
| **Dynamic Work Order Checklists** | MVP | Medium | **Partially** (PM checklists exist) | Dynamic, templated WO checklists |
| **Automated HL7/FHIR Status Broadcasts** | Phase 2 | High | **Not Implemented** | REST API + HL7/FHIR |
| **Predictive IoT Run-Hour Triggers** | Phase 2 | High | **Not Implemented** | Run-hour/cycle tracking + trigger logic |

---

## 4. Database Architecture Audit

### 4.1 Critical Bugs

| # | Severity | Description | Impact |
|---|---|---|---|
| **B-1** | **Critical** | `wo_comments.author_id` FK references `public.profiles(id)` instead of `ebiomed.profiles(id)`. The `public.profiles` table does not exist. | FK constraint will fail at creation time. Comments are broken. |
| **B-2** | **High** | `ebiomed` schema not listed in `config.toml` `api.schemas`. Only checklist tables have explicit `GRANT` statements. | Core tables may not be API-accessible via PostgREST (relies on undefined default privileges). |
| **B-3** | **High** | Trigger functions (`decrement_part_quantity`, `restore_part_quantity`) created in `public` schema (unqualified), not `ebiomed`. | Functions live outside the isolated schema. Potential search path issues. |

### 4.2 Missing Tables for Compliance

| Table | Purpose | PRD Coverage |
|---|---|---|
| `audit_log` | Append-only change history: table_name, record_id, field_name, old_value, new_value, changed_by, changed_at, reason | FDA 21 CFR Part 11 |
| `signatures` | Digital signature events: signer_id, action (verified/calibrated/approved), timestamp, meaning, record_id | FDA 21 CFR Part 11 |
| `reference_standards` | Calibration master instruments: serial_number, name, certificate_number, certificate_expiry, calibration_interval | ISO 15189/17025 |
| `calibration_readings` | Quantitative calibration data: equipment_id, parameter, measured_value, expected_value, tolerance_min, tolerance_max, passed, timestamp | ISO 15189/17025 |
| `environmental_readings` | Environmental conditions: temperature, humidity, recorded_at, recorded_by | ISO 15189/17025 |
| `certificates` | Generated certificates: equipment_id, hash, pdf_url, issued_by, issued_at, valid_until | FDA + ISO |

### 4.3 Schema Gaps

| Gap | Severity | Details |
|---|---|---|
| No `updated_at` on `work_orders`, `wo_comments`, `profiles`, `departments`, `viewer_departments`, `checklist_templates`, `checklist_submissions` | Medium | Only `equipment` and `parts` have `updated_at`. No auto-trigger for it. |
| No `created_by` on `equipment`, `pm_schedules`, `parts`, `comments`, `departments` | Medium | Only `work_orders` tracks who created the record. |
| No soft-delete; destructive `ON DELETE CASCADE` on several FKs | High | Compliance requires data preservation. Deleted records are permanently lost. |
| Public RLS for `equipment` (`USING (true)`) | Medium | Entire equipment registry is world-readable via the PostgREST API. |
| No `equipment_status` value for "Certified & In Service" | Medium | Enum values: `active`, `inactive`, `retired`, `under_repair`. No "certified" status. |

---

## 5. Persona Readiness Assessment

| Persona | Core Need in EMMS | Current State | Readiness |
|---|---|---|---|
| **Clinical Engineering / Lab Manager** | Dashboards: certificate expirations, Westgard drift alerts, total compliance posture | Dashboard exists with stats cards, overdue PMs, low stock. No certificate tracking, no calibration drift analytics, no compliance posture metric. | **30%** |
| **Biomedical / Laboratory Technologist** | Mobile/tablet: scan barcodes, log quantitative metrics, sign off at bench | QR scanning + fault reporting on public routes (no auth). PM checklist exists but is ok/not_ok only — no quantitative logging, no sign-off flow. | **25%** |
| **External Quality Auditor** | Read-only "Audit Mode": chronological audit trail, certificates for any asset | No audit trail viewer exists. No certificate output. Equipment history tab shows WOs and checklist submissions but not in compliance-audit format. | **5%** |

---

## 6. Gap Heatmap

| PRD Section | Critical Gaps | High Gaps | Medium Gaps | Low Gaps |
|---|---|---|---|---|
| 3. FDA 21 CFR Part 11 | Immutable audit trail, dual-factor signatures, signature manifestation | — | — | — |
| 3. ISO 15189/17025 | Metrological traceability, environmental logging | — | — | — |
| 4.1 Asset Registry | — | Parent-child hierarchy | Public RLS on equipment | GMDN/UDI fields |
| 4.2 Certification Engine | Certificate generator, tolerance engine | Usage-based PM triggers | — | — |
| 5. Certification Workflow | All 5 steps have compliance gaps | — | — | — |
| 6. Non-Functional | — | HL7/FHIR, REST API | AES-256 enforcement | — |
| Database | Audit log table, FK bug | Soft-delete, schema exposure, missing `updated_at` | Inconsistent UUID generation, trigger schema | — |

---

## 7. Key Findings

1. **The current system is a good CMMS but not an EMMS.** It handles asset tracking and maintenance workflows effectively but lacks every compliance-critical feature the PRD requires.

2. **Zero auditability.** Without an append-only audit trail, the system would fail any FDA or ISO audit. Every edit is destructive — old values are lost forever.

3. **No digital signing whatsoever.** Closing a work order does not require re-authentication. There is no concept of a signature event in the data model or UI.

4. **Calibration is not modeled.** The PRD's core value proposition — calibration verification with tolerance checking, metrological traceability, and certificate generation — has no representation in the codebase.

5. **Database has production-critical bugs** (comment FK, schema API exposure) that should be fixed before any compliance work begins.

6. **Test coverage is near-zero** (2 files, 5 tests). No tests for server actions, schemas, UI components, or workflows.
