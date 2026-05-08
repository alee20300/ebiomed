# Public Fault Reporting via Barcode — Design Spec

**Date:** 2026-05-08
**Status:** Approved
**Dependency:** Existing EMMS (ebiomed schema)

---

## 1. Overview

A public-facing fault reporting flow that lets any hospital staff (nurses, doctors, etc.) scan an equipment barcode and submit a fault report — no login required. Automatically creates a corrective work order.

---

## 2. Flow

1. Staff scans barcode on equipment → routes to `/report?tag=BM-001`
2. Page shows equipment confirmation (name, photo, status)
3. Staff fills form: **photo of issue** + **description (required)** + optional name/department
4. Submit → creates corrective work_order (open, medium priority), sets equipment to `under_repair`

---

## 3. Barcode Strategy

- Existing `tag_number` (e.g. `BM-001`) serves as the barcode value
- Equipment detail page shows a barcode image (Code 128) for printing/stickering
- Scanning: `BarcodeDetector` web API on supported browsers, with manual tag entry fallback
- Library: `html5-qrcode` (lightweight, supports barcodes via ZXing)

---

## 4. Data Changes

Add 3 columns to `ebiomed.work_orders`:

| Field | Type | Notes |
|-------|------|-------|
| reported_by_name | text | Nullable, staff name |
| reported_by_department | text | Nullable, e.g. "ICU Nursing" |
| issue_photo_url | text | Nullable, Supabase Storage path |

---

## 5. New Pages & Components

### 5.1 `/report` — Public fault report (no auth)

- `src/app/report/page.tsx` — main page
- `src/components/report/fault-form.tsx` — the form
- `src/components/report/barcode-scanner.tsx` — barcode scanner widget

**Middleware bypass:** Add `/report` to public routes (no auth redirect).

### 5.2 Barcode display on equipment detail

- `src/components/equipment/barcode-display.tsx` — renders Code 128 barcode for tag_number using a lightweight SVG barcode generator (no npm dep — inline SVG generation)

### 5.3 BarcodeScanner component

```tsx
// Uses BarcodeDetector API or html5-qrcode fallback
// On scan: redirects to /report?tag=<scanned-value>
// Manual fallback: text input to type tag number
```

### 5.4 FaultForm component

```tsx
// Fields:
// - Equipment confirmation card (tag, name, photo, status — read only)
// - Photo upload (file input, accept="image/*", capture="environment" on mobile, required)
// - Description (textarea, required, min 10 chars)
// - Reporter name (text, optional)
// - Reporter department (text, optional)
// - Submit button
//
// On submit: server action uploads photo to Supabase Storage,
// creates work_order with issue_photo_url + description,
// updates equipment status to under_repair
```

---

## 6. Supabase Storage

- Bucket: `fault-photos` (public read)
- Folder: `{year}/{month}/{work_order_id}.webp`
- Max size: 10 MB
- Accepted: image/jpeg, image/png, image/webp

---

## 7. Server Actions

### `src/lib/actions/fault-report.ts`

```typescript
"use server"

export async function submitFaultReport(formData: FormData) {
  // 1. Validate: equipment_id, description (min 10 chars), photo (required)
  // 2. Upload photo to Supabase Storage
  // 3. Insert work_order (corrective, open, medium)
  // 4. Update equipment status → under_repair
  // 5. Redirect to /report/success?wo=<id>
}
```

---

## 8. Routes

| Route | Auth | Purpose |
|-------|------|---------|
| `/report` | Public | Barcode scanner + manual entry |
| `/report?tag=BM-001` | Public | Fault form for specific equipment |
| `/report/success?wo=<id>` | Public | Confirmation page |

---

## 9. Middleware Update

Add `/report` to public paths in `src/proxy.ts`:

```typescript
const isPublic = url.pathname.startsWith("/report") || 
                 url.pathname.startsWith("/login") || 
                 url.pathname.startsWith("/auth")
```

---

## 10. Out of Scope

- Email/push notifications for new fault reports
- Reporter identity verification
- Barcode label printing (just display for now — staff can screenshot+print)
- QR codes (barcode only)
- Photo annotations/markup
- Offline queuing
