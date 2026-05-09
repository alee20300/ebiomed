# QR Code Equipment Labels — Design Spec

**Date:** 2026-05-09
**Status:** Draft

## Overview

Add QR code labels to equipment detail pages. Each QR code encodes a full URL that opens the fault report page with that equipment pre-selected. Staff print the QR label and stick it on the physical equipment. Anyone (even visitors without the app) scans the QR with their phone camera and lands directly on the fault form for that device.

The existing CODE128 barcode (for dedicated scanners) remains unchanged.

## User Flows

| Flow | Scanner | Result |
|------|---------|--------|
| **QR label** | Native phone camera (iOS/Android) | Scans QR → browser opens `https://app.ebiomed.com/report?tag=BM-001` → fault form |
| **In-app barcode** | BarcodeScanner component (html5-qrcode) | Scans CODE128 → routes to `/report?tag=...` via app |
| **QR in-app** (edge case) | BarcodeScanner scans a QR label | Decodes URL → extract tag from query param → route to `/report?tag=...` |

## Components

### 1. QRCodeDisplay

New client component at `src/components/report/qrcode-display.tsx`.

- Uses the `qrcode` npm package to generate an SVG QR code
- Props: `value: string` (the full URL to encode)
- Renders an `<img>` or raw SVG element — no canvas dependency
- Responsive: `max-w-[200px]` to fit label layout

### 2. QR Label Card on Equipment Detail

Add a new card to `src/app/(app)/equipment/[id]/page.tsx`, below the existing barcode card.

Layout:
```
+--------------------------------------------------+
|  [QR code]   Ventilator V500                      |
|   (200px)    Tag: BM-001                          |
|              ICU — ICU Room 3                     |
|                                                    |
|              [Print Label]                         |
+--------------------------------------------------+
```

- Card sits below the barcode card
- QR code left-aligned, equipment info right-aligned
- "Print Label" button triggers `window.print()`
- Entire card renders as a single block

### 3. Print Styles

Add `@media print` rules to `src/app/globals.css`:

- Hide everything except the QR label card
- Hide sidebar, header, bottom nav, tabs, other cards
- Show QR card at full width, centered on page
- Optionally add `page-break-after: always` if multiple cards

### 4. Scanner Update (Optional Polish)

Update `src/components/report/barcode-scanner.tsx` to handle QR-encoded URLs:

- If scanned text starts with `http`, parse the URL and extract the `tag` query parameter
- Route to `/report?tag=<extracted_tag>` instead of `/report?tag=<full_url>`

## URL Format

QR codes encode: `<SITE_URL>/report?tag=<tag_number>`

The site URL comes from `NEXT_PUBLIC_SITE_URL` environment variable. In development (`localhost:3000`) the URL would be `http://localhost:3000/report?tag=BM-001`. In production it would use the deployed domain.

If `NEXT_PUBLIC_SITE_URL` is not set, default to `window.location.origin` on the client side.

## Data Model

No database changes. QR codes are generated on-the-fly from the equipment `tag_number`. The `tag_number` already uniquely identifies equipment.

## New Dependency

| Package | Version | Size | Purpose |
|---------|---------|------|---------|
| `qrcode` | `^1.5.4` | ~20KB | Generate QR code SVGs |

`qrcode` is a lightweight, zero-dependency library that outputs QR codes as SVG, canvas, or data URL.

## Files Changed

| File | Change |
|------|--------|
| `src/components/report/qrcode-display.tsx` | **New** — QR code SVG generator |
| `src/app/(app)/equipment/[id]/page.tsx` | Add QR label card below barcode card |
| `src/app/globals.css` | Add `@media print` styles |
| `src/components/report/barcode-scanner.tsx` | Handle scanned URLs, extract tag param |
| `package.json` | Add `qrcode` dependency |

## Out of Scope

- QR code on any page other than equipment detail
- Batch printing of multiple QR labels
- Custom label sizes or templates
- QR codes that encode anything other than the fault report URL
- Authentication on QR-scanned fault reports (already handled — `/report` is public)
- Updating existing barcode workflow
