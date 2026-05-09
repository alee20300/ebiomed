# QR Code Equipment Labels — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add QR code labels to equipment detail pages that encode a fault report URL, printable as equipment stickers.

**Architecture:** New `QRCodeDisplay` client component generates SVG QR codes from the `qrcode` npm package. A label card on the equipment detail page combines the QR with equipment info (name, tag, department) and a print button. CSS `@media print` hides everything except the label. The existing barcode scanner gets a small update to handle URL-encoded QR codes when scanned in-app.

**Tech Stack:** Next.js 16 App Router, React 19, `qrcode` package, Tailwind CSS, TypeScript

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `package.json` | Modify | Add `qrcode` dependency |
| `src/components/report/qrcode-display.tsx` | Create | QR code SVG generator |
| `src/app/(app)/equipment/[id]/page.tsx` | Modify | Add QR label card |
| `src/app/globals.css` | Modify | Add `@media print` styles |
| `src/components/report/barcode-scanner.tsx` | Modify | Handle scanned URLs |

---

### Task 1: Install qrcode Dependency

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install the `qrcode` package**

```bash
PATH="/opt/homebrew/bin:$PATH" npm install qrcode
```

- [ ] **Step 2: Verify it installed**

```bash
grep '"qrcode"' package.json
```

Expected: line showing `"qrcode": "^1.5.4"` (or similar version)

---

### Task 2: Create QRCodeDisplay Component

**Files:**
- Create: `src/components/report/qrcode-display.tsx`

- [ ] **Step 1: Create the component file**

```tsx
"use client"

import { useEffect, useRef } from "react"
import QRCode from "qrcode"

export function QRCodeDisplay({ value }: { value: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (canvasRef.current) {
      QRCode.toCanvas(canvasRef.current, value, {
        width: 200,
        margin: 2,
        color: { dark: "#000000", light: "#ffffff" },
      })
    }
  }, [value])

  return <canvas ref={canvasRef} className="max-w-[200px]" />
}
```

- [ ] **Step 2: Verify component compiles**

```bash
PATH="/opt/homebrew/bin:$PATH" npx tsc --noEmit src/components/report/qrcode-display.tsx 2>&1 | head -5
```

Expected: no type errors. (May need `--jsx react-jsx` flag or check via `npm run dev` instead.)

---

### Task 3: Build QR Label Card on Equipment Detail Page

**Files:**
- Modify: `src/app/(app)/equipment/[id]/page.tsx`

- [ ] **Step 1: Add imports at the top of the file**

Add these import lines below the existing imports (around line 14):

```tsx
import { QRCodeDisplay } from "@/components/report/qrcode-display"
```

Add this import alongside the existing lucide imports:

```tsx
import { ChevronLeft, Printer } from "lucide-react"
```

- [ ] **Step 2: Add site URL constant and QR label card below the barcode card**

Insert the QR label card after the existing barcode card closing `</Card>` (after line 77) and before the closing `</div>` (line 78):

```tsx
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">QR Label</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-6 print-only">
            <QRCodeDisplay
              value={`${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/report?tag=${equipment.tag_number}`}
            />
            <div className="text-sm space-y-1">
              <p className="font-semibold text-base">{equipment.name}</p>
              <p className="text-muted-foreground">Tag: {equipment.tag_number}</p>
              <p className="text-muted-foreground">{equipment.department} — {equipment.location}</p>
            </div>
          </div>
          <Button
            onClick={() => window.print()}
            className="mt-4 w-full"
            variant="outline"
          >
            <Printer className="mr-2 h-4 w-4" />
            Print Label
          </Button>
          <p className="mt-2 text-xs text-muted-foreground text-center">
            Scan QR code with phone camera to report a fault
          </p>
        </CardContent>
      </Card>
```

- [ ] **Step 3: Verify the page still renders**

```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/equipment 2>/dev/null
```

Expected: `307` (redirect to login — expected for protected route; try after logging in via browser)

---

### Task 4: Add Print Styles to Globals.css

**Files:**
- Modify: `src/app/globals.css`

- [ ] **Step 1: Add print media query at the end of globals.css**

Append the following to `src/app/globals.css`:

```css
@media print {
  body * {
    visibility: hidden;
  }

  .print-only,
  .print-only * {
    visibility: visible;
  }

  .print-only {
    position: absolute;
    left: 0;
    top: 0;
    width: 100%;
    padding: 20px;
  }

  @page {
    margin: 10mm;
    size: auto;
  }
}
```

- [ ] **Step 2: Verify the CSS compiles**

```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/report 2>/dev/null
```

Expected: `200` (CSS changes shouldn't break the build; check browser console for any CSS errors)

---

### Task 5: Update BarcodeScanner to Handle QR-Encoded URLs

**Files:**
- Modify: `src/components/report/barcode-scanner.tsx`

- [ ] **Step 1: Update the scanner callback to handle URLs**

Replace the scanner `start` callback (lines 27-30) with URL-aware logic. The current code:

```tsx
        (decodedText) => {
          scanner.stop()
          setMode("idle")
          router.push(`/report?tag=${encodeURIComponent(decodedText)}`)
        },
```

Replace with:

```tsx
        (decodedText) => {
          scanner.stop()
          setMode("idle")
          // If the scanned text is a URL, extract the tag parameter
          if (decodedText.startsWith("http://") || decodedText.startsWith("https://")) {
            try {
              const url = new URL(decodedText)
              const tag = url.searchParams.get("tag")
              if (tag) {
                router.push(`/report?tag=${encodeURIComponent(tag)}`)
                return
              }
            } catch {
              // Not a valid URL, fall through to treat as tag
            }
          }
          router.push(`/report?tag=${encodeURIComponent(decodedText)}`)
        },
```

- [ ] **Step 2: Verify the scanner still compiles**

```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/report 2>/dev/null
```

Expected: `200`

---

### Task 6: Verify End-to-End

- [ ] **Step 1: Verify the QR label renders on equipment detail**

Open `http://localhost:3000/equipment/<any-id>` in the browser (login first). Scroll to the bottom. You should see a barcode card followed by a QR label card with a canvas QR code, equipment info, and a "Print Label" button.

- [ ] **Step 2: Verify print behavior**

Click "Print Label" on the QR label card. The print preview should show only the QR code and equipment info, not the sidebar, header, tabs, or other cards.

- [ ] **Step 3: Verify URL scanning (in-app)**

Paste `http://localhost:3000/report?tag=BM-001` into the manual tag input on `/report` and click Go. The scanner should extract `BM-001` and route to the fault form.

---

### Task 7: Commit

- [ ] **Step 1: Add all changed files and commit**

```bash
git add package.json package-lock.json \
  src/components/report/qrcode-display.tsx \
  src/app/\(app\)/equipment/\[id\]/page.tsx \
  src/app/globals.css \
  src/components/report/barcode-scanner.tsx

git commit -m "feat: add QR code labels to equipment detail pages"
```
